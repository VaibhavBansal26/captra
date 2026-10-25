import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ComponentType, type ReactNode } from 'react'
import { createRuntime, type AgentApp, type CapabilityInput, type CapabilityName, type CapabilityOutput as CapabilityValue, type CapabilityResult, type CaptraEvent, type ChatMessage, type ChatOutput, type ExecutionIdentity, type RemoteCapabilityResult, type RunRecord, type RuntimeOptions } from '@captra-ai/core'
import type { CaptraClient } from '@captra-ai/client'
import { createState, hashStateKey, type CaptraState, type StateKey } from '@captra-ai/state'

const defaultState=createState()
const StateContext=createContext<CaptraState>(defaultState)
export function CaptraStateProvider({state,children}:{state:CaptraState;children:ReactNode}){return createElement(StateContext.Provider,{value:state},children)}
export function useCaptraState<T=unknown>(key:StateKey,options:{load?:()=>Promise<T>;enabled?:boolean;staleTime?:number;state?:CaptraState}={}){
  const inherited=useContext(StateContext),store=options.state??inherited,hash=hashStateKey(key)
  const subscribe=useCallback((listener:()=>void)=>store.subscribe(key,listener),[store,hash])
  const getSnapshot=useCallback(()=>store.snapshot<T>(key),[store,hash])
  const snapshot=useSyncExternalStore(subscribe,getSnapshot,getSnapshot)
  useEffect(()=>{if(options.load&&(options.enabled??true)&&(snapshot.status==='idle'||(snapshot.status==='success'&&snapshot.stale)))void store.fetch(key,options.load,{staleTime:options.staleTime}).catch(()=>{})},[store,hash,options.load,options.enabled,options.staleTime,snapshot.status,snapshot.stale])
  return {...snapshot,set:useCallback((value:T)=>store.set(key,value),[store,hash]),refresh:useCallback(()=>options.load?store.fetch(key,options.load,{force:true}):Promise.resolve(store.get<T>(key)),[store,hash,options.load]),invalidate:useCallback(()=>store.invalidate(key),[store,hash])}
}
export function useOptimisticState<T=unknown>(key:StateKey,options:{state?:CaptraState}={}){const inherited=useContext(StateContext),store=options.state??inherited,hash=hashStateKey(key);return useCallback((update:T|((current:T|undefined)=>T))=>store.optimistic(key,update),[store,hash])}

export type UseCaptraOptions=RuntimeOptions&{identity?:ExecutionIdentity;approverIdentity?:ExecutionIdentity;state?:CaptraState;approve?:(result:CapabilityResult)=>Promise<boolean>}
export function useAgentApp(app: AgentApp, options:UseCaptraOptions={}) {
  const inherited=useContext(StateContext),state=options.state??inherited
  const runtime = useMemo(() => createRuntime(app, options), [app, options.memory, options.runs, options.budgets, options.effects, options.authorize, options.authorizeApproval, options.signal])
  const [result, setResult] = useState<CapabilityResult | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (capability: string, input: unknown) => {
    setPending(true)
    setError(null)
    try {
      const identity=options.identity??{tenantId:'default',userId:'anonymous',projectId:'default'}
      let next=await runtime.execute({capability,input,identity})
      if(next.run.status==='waiting_for_approval'&&options.approve){if(!options.approverIdentity)throw new Error('Local approval requires approverIdentity');next=await runtime.approve(next.run.id,(await options.approve(next))?'approved':'rejected',options.approverIdentity)}
      setResult(next)
      if(next.run.status==='completed')state.apply(next.capability.state)
      return next
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unknown runtime error')
      return null
    } finally {
      setPending(false)
    }
  }, [runtime, state, options.identity, options.approverIdentity, options.approve])

  return { runtime, result, pending, error, run }
}

export function useCapability(app:AgentApp,name:string,options:UseCaptraOptions={}){
  const state=useAgentApp(app,options)
  return {...state,run:useCallback((input:unknown)=>state.run(name,input),[state.run,name])}
}

export function useRemoteCapability<App extends AgentApp,Name extends CapabilityName<App>>(client:CaptraClient<App>,name:Name,options:{state?:CaptraState}={}){
  type Input=CapabilityInput<App,Name>;type Output=CapabilityValue<App,Name>;type Result=RemoteCapabilityResult<Output>
  const inherited=useContext(StateContext),store=options.state??inherited
  const [result,setResult]=useState<Result|null>(null),[events,setEvents]=useState<CaptraEvent[]>([]),[pending,setPending]=useState(false),[error,setError]=useState<string|null>(null)
  const attempt=useCallback(async<T,>(operation:()=>Promise<T>)=>{setPending(true);setError(null);try{return await operation()}catch(caught){setError(caught instanceof Error?caught.message:'Unknown runtime error');return null}finally{setPending(false)}},[])
  const accept=useCallback((next:Result)=>{setResult(next);setEvents(next.trace);if(next.run.status==='completed')store.apply(next.capability.state);return next},[store])
  const run=useCallback((input:Input,idempotencyKey?:string)=>attempt(async()=>accept(await client.execute(name,input,idempotencyKey) as Result)),[attempt,accept,client,name])
  const stream=useCallback((input:Input,idempotencyKey?:string)=>attempt(async()=>{setEvents([]);let completed:Result|null=null;for await(const message of client.stream(name,input,idempotencyKey)){if(message.event==='trace')setEvents(current=>[...current,message.data]);else if(message.event==='result')completed=accept(message.data as Result);else throw new Error(message.data.message)}return completed}),[attempt,accept,client,name])
  const approve=useCallback(()=>attempt(async()=>{if(!result)return null;return accept(await client.approve(result.run.id) as Result)}),[attempt,accept,client,result])
  const reject=useCallback(()=>attempt(async()=>{if(!result)return null;const next=await client.reject(result.run.id) as Result;setResult(next);setEvents(next.trace);return next}),[attempt,client,result])
  const cancel=useCallback(()=>attempt(async()=>{if(!result)return null;const next=await client.cancel(result.run.id);setResult(current=>current?{...current,run:next}:current);return next}),[attempt,client,result])
  const refreshEvents=useCallback(()=>attempt(async()=>{if(!result)return [];const next=await client.events(result.run.id);setEvents(next);return next}),[attempt,client,result])
  const reset=useCallback(()=>{setResult(null);setEvents([]);setError(null);setPending(false)},[])
  return {run,stream,approve,reject,cancel,refreshEvents,reset,result,events,pending,error}
}

export type UseChatOptions={conversationId?:string;initialMessages?:readonly ChatMessage[];idempotencyKey?:()=>string;reconnectIntervalMs?:number}
export function useChat<App extends AgentApp,Name extends CapabilityName<App>>(client:CaptraClient<App>,capability:Name,options:UseChatOptions={}){
  const [messages,setMessages]=useState<ChatMessage[]>([...(options.initialMessages??[])]),[events,setEvents]=useState<CaptraEvent[]>([]),[result,setResult]=useState<RemoteCapabilityResult<ChatOutput>|null>(null),[pending,setPending]=useState(false),[error,setError]=useState<string|null>(null),[draft,setDraft]=useState('')
  const controller=useRef<AbortController|null>(null),activeRunId=useRef<string|null>(null)
  const usage=useMemo(()=>events.filter(event=>event.type==='budget.committed').reduce((total,event)=>{const data=event.data as {tokens?:number;costUsd?:number}|undefined;return {tokens:total.tokens+(data?.tokens??0),costUsd:total.costUsd+(data?.costUsd??0)}},{tokens:0,costUsd:0}),[events])
  const send=useCallback(async(content:string)=>{if(!content.trim()||pending)return null;const user:ChatMessage={id:crypto.randomUUID(),role:'user',content},history=[...messages,user],assistantId=crypto.randomUUID(),abort=new AbortController();controller.current=abort;setMessages([...history,{id:assistantId,role:'assistant',content:''}]);setEvents([]);setDraft('');setPending(true);setError(null);let completed:RemoteCapabilityResult<ChatOutput>|null=null
    try{for await(const frame of client.stream(capability,{messages:history,conversationId:options.conversationId} as CapabilityInput<App,Name>,options.idempotencyKey?.(),abort.signal)){if(frame.event==='trace'){activeRunId.current=frame.data.runId;setEvents(current=>[...current,frame.data]);if(frame.data.type==='chat.delta'){const delta=(frame.data.data as {delta?:string}|undefined)?.delta??frame.data.detail;setDraft(current=>current+delta);setMessages(current=>current.map(message=>message.id===assistantId?{...message,content:message.content+delta}:message))}}else if(frame.event==='result'){completed=frame.data as RemoteCapabilityResult<ChatOutput>;activeRunId.current=completed.run.id;setResult(completed);if(completed.run.status==='completed'&&completed.value?.message)setMessages(current=>current.map(message=>message.id===assistantId?completed!.value.message:message))}else throw new Error(frame.data.message)}return completed}catch(caught){if(!abort.signal.aborted)setError(caught instanceof Error?caught.message:'Unknown chat error');return null}finally{if(controller.current===abort)controller.current=null;setPending(false)}
  },[client,capability,messages,pending,options.conversationId,options.idempotencyKey,controller])
  const stop=useCallback(async()=>{controller.current?.abort();const runId=activeRunId.current;if(runId)await client.cancel(runId).catch(()=>{});setPending(false)},[client])
  const approve=useCallback(async()=>{if(!result)return null;const next=await client.approve(result.run.id) as RemoteCapabilityResult<ChatOutput>;setResult(next);if(next.run.status==='completed'&&next.value?.message)setMessages(current=>{const last=current.at(-1);return last?.role==='assistant'&&!last.content?[...current.slice(0,-1),next.value.message]:[...current,next.value.message]});return next},[client,result])
  const reject=useCallback(async()=>{if(!result)return null;const next=await client.reject(result.run.id) as RemoteCapabilityResult<ChatOutput>;setResult(next);return next},[client,result])
  const reconnect=useCallback(async(runId:string)=>{const abort=new AbortController();controller.current=abort;activeRunId.current=runId;setEvents([]);setDraft('');setPending(true);setError(null);try{let run=await client.run(runId),after=0;for(;;){const nextEvents=await client.events(runId,after);if(nextEvents.length){after=nextEvents.at(-1)!.sequence;setEvents(current=>mergeEvents(current,nextEvents));for(const event of nextEvents)if(event.type==='chat.delta'){const delta=(event.data as {delta?:string}|undefined)?.delta??event.detail;setDraft(current=>current+delta)}}if(['completed','failed','cancelled','waiting_for_approval'].includes(run.status)){const value=run.output as ChatOutput;const next={run,capability:{name:String(capability),mode:'agent' as const,description:String(capability),view:'ChatMessage',state:{reads:[],writes:[],invalidates:[],locks:[]}},value,trace:await client.events(runId)};setResult(next);if(run.status==='completed'&&value?.message)setMessages(current=>current.at(-1)?.id===value.message.id?current:[...current,value.message]);return next}await wait(options.reconnectIntervalMs??500,abort.signal);run=await client.run(runId)}}catch(caught){if(!abort.signal.aborted)setError(caught instanceof Error?caught.message:'Unknown chat error');return null}finally{if(controller.current===abort)controller.current=null;setPending(false)}},[client,capability,options.reconnectIntervalMs])
  const reset=useCallback(()=>{controller.current?.abort();activeRunId.current=null;setMessages([...(options.initialMessages??[])]);setEvents([]);setResult(null);setDraft('');setError(null);setPending(false)},[options.initialMessages])
  return {messages,send,stop,approve,reject,reconnect,reset,setMessages,result,run:result?.run??null,status:result?.run.status??(pending?'running':'idle'),approval:result?.run.approval??null,events,pending,error,draft,usage,budget:[...events].reverse().find(event=>event.type==='budget.checked')?.data??null}
}

function mergeEvents(current:readonly CaptraEvent[],incoming:readonly CaptraEvent[]){const ids=new Set(current.map(event=>event.id));return [...current,...incoming.filter(event=>!ids.has(event.id))]}
function wait(milliseconds:number,signal:AbortSignal){return new Promise<void>((resolve,reject)=>{const timer=setTimeout(resolve,milliseconds),abort=()=>{clearTimeout(timer);reject(signal.reason??new DOMException('Aborted','AbortError'))};if(signal.aborted)abort();else signal.addEventListener('abort',abort,{once:true})})}

export const useCaptra = useAgentApp

export function CapabilityOutput({ result, views = {} }: { result: CapabilityResult|RemoteCapabilityResult; views?:Record<string,ComponentType<any>> }) {
  if (result.run.status !== 'completed') return null
  const reference=result.capability.view
  const component=typeof reference==='string'?views[reference]:reference.component as ComponentType<any>|undefined
  if (!component) return null
  return createElement(component, {
    value: result.value,
    capability: result.capability.name,
  })
}

export type CaptraPrimitiveProps={className?:string}
const statusLabels:Record<RunRecord['status'],string>={created:'Created',queued:'Queued',running:'Running',waiting_for_approval:'Waiting for approval',completed:'Completed',failed:'Failed',cancelled:'Cancelled'}

export function RunStatus({run,className,labels={}}:CaptraPrimitiveProps&{run:RunRecord;labels?:Partial<Record<RunRecord['status'],string>>}){
  return <span className={className} data-captra="run-status" data-status={run.status} role="status" aria-live="polite">{labels[run.status]??statusLabels[run.status]}</span>
}

export function ApprovalPanel({result,onApprove,onReject,pending=false,className,title='Human approval required',approveLabel='Approve',rejectLabel='Reject',children}:CaptraPrimitiveProps&{result:CapabilityResult|RemoteCapabilityResult;onApprove:()=>void|Promise<void>;onReject:()=>void|Promise<void>;pending?:boolean;title?:string;approveLabel?:string;rejectLabel?:string;children?:ReactNode}){
  if(result.run.status!=='waiting_for_approval')return null
  return <section className={className} data-captra="approval" aria-labelledby={`captra-approval-${result.run.id}`}><h2 id={`captra-approval-${result.run.id}`}>{title}</h2>{children??<p>{result.capability.description}</p>}<div><button type="button" disabled={pending} onClick={()=>void onReject()}>{rejectLabel}</button><button type="button" disabled={pending} onClick={()=>void onApprove()}>{approveLabel}</button></div></section>
}

export function EventTimeline({events,className,empty='No run events yet.',renderTime=at=>new Date(at).toISOString()}:CaptraPrimitiveProps&{events:readonly CaptraEvent[];empty?:ReactNode;renderTime?:(at:number,event:CaptraEvent)=>ReactNode}){
  if(!events.length)return <p className={className} data-captra="event-timeline-empty">{empty}</p>
  return <ol className={className} data-captra="event-timeline">{events.map(event=><li key={event.id} data-event={event.type}><div><strong>{event.type}</strong><span>{event.detail}</span></div><time dateTime={new Date(event.at).toISOString()}>{renderTime(event.at,event)}</time></li>)}</ol>
}

export function CapabilityBoundary({result,views={},pending=false,error,onApprove,onReject,showTrace=false,className,pendingFallback='Running capability…'}:CaptraPrimitiveProps&{result?:CapabilityResult|RemoteCapabilityResult|null;views?:Record<string,ComponentType<any>>;pending?:boolean;error?:unknown;onApprove?:()=>void|Promise<void>;onReject?:()=>void|Promise<void>;showTrace?:boolean;pendingFallback?:ReactNode}){
  const message=error instanceof Error?error.message:typeof error==='string'?error:null
  return <section className={className} data-captra="capability-boundary" aria-busy={pending}>{message&&<p role="alert" data-captra="error">{message}</p>}{pending&&<div role="status" aria-live="polite" data-captra="pending">{pendingFallback}</div>}{result&&<><RunStatus run={result.run}/>{result.run.status==='failed'&&result.run.error&&<p role="alert" data-captra="error">{result.run.error}</p>}<CapabilityOutput result={result} views={views}/>{onApprove&&onReject&&<ApprovalPanel result={result} onApprove={onApprove} onReject={onReject} pending={pending}/>} {showTrace&&<EventTimeline events={result.trace}/>}</>}</section>
}
