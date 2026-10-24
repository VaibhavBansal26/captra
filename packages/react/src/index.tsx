import { createElement, useCallback, useMemo, useState, type ComponentType, type ReactNode } from 'react'
import { createRuntime, type AgentApp, type CapabilityInput, type CapabilityName, type CapabilityOutput as CapabilityValue, type CapabilityResult, type CaptraEvent, type ExecutionIdentity, type RemoteCapabilityResult, type RunRecord, type RuntimeOptions } from '@captra/core'
import type { CaptraClient } from '@captra/client'

export type UseCaptraOptions=RuntimeOptions&{identity?:ExecutionIdentity;approve?:(result:CapabilityResult)=>Promise<boolean>}
export function useAgentApp(app: AgentApp, options:UseCaptraOptions={}) {
  const runtime = useMemo(() => createRuntime(app, options), [app, options.memory, options.runs, options.authorize, options.signal])
  const [result, setResult] = useState<CapabilityResult | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (capability: string, input: unknown) => {
    setPending(true)
    setError(null)
    try {
      const identity=options.identity??{tenantId:'default',userId:'anonymous',projectId:'default'}
      let next=await runtime.execute({capability,input,identity})
      if(next.run.status==='waiting_for_approval'&&options.approve)next=await runtime.approve(next.run.id,(await options.approve(next))?'approved':'rejected')
      setResult(next)
      return next
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unknown runtime error')
      return null
    } finally {
      setPending(false)
    }
  }, [runtime, options.identity, options.approve])

  return { runtime, result, pending, error, run }
}

export function useCapability(app:AgentApp,name:string,options:UseCaptraOptions={}){
  const state=useAgentApp(app,options)
  return {...state,run:useCallback((input:unknown)=>state.run(name,input),[state.run,name])}
}

export function useRemoteCapability<App extends AgentApp,Name extends CapabilityName<App>>(client:CaptraClient<App>,name:Name){
  type Input=CapabilityInput<App,Name>;type Output=CapabilityValue<App,Name>;type Result=RemoteCapabilityResult<Output>
  const [result,setResult]=useState<Result|null>(null),[events,setEvents]=useState<CaptraEvent[]>([]),[pending,setPending]=useState(false),[error,setError]=useState<string|null>(null)
  const attempt=useCallback(async<T,>(operation:()=>Promise<T>)=>{setPending(true);setError(null);try{return await operation()}catch(caught){setError(caught instanceof Error?caught.message:'Unknown runtime error');return null}finally{setPending(false)}},[])
  const run=useCallback((input:Input,idempotencyKey?:string)=>attempt(async()=>{const next=await client.execute(name,input,idempotencyKey) as Result;setResult(next);setEvents(next.trace);return next}),[attempt,client,name])
  const stream=useCallback((input:Input,idempotencyKey?:string)=>attempt(async()=>{setEvents([]);let completed:Result|null=null;for await(const message of client.stream(name,input,idempotencyKey)){if(message.event==='trace')setEvents(current=>[...current,message.data]);else if(message.event==='result'){completed=message.data as Result;setResult(completed);setEvents(completed.trace)}else throw new Error(message.data.message)}return completed}),[attempt,client,name])
  const approve=useCallback(()=>attempt(async()=>{if(!result)return null;const next=await client.approve(result.run.id) as Result;setResult(next);setEvents(next.trace);return next}),[attempt,client,result])
  const reject=useCallback(()=>attempt(async()=>{if(!result)return null;const next=await client.reject(result.run.id) as Result;setResult(next);setEvents(next.trace);return next}),[attempt,client,result])
  const cancel=useCallback(()=>attempt(async()=>{if(!result)return null;const next=await client.cancel(result.run.id);setResult(current=>current?{...current,run:next}:current);return next}),[attempt,client,result])
  const refreshEvents=useCallback(()=>attempt(async()=>{if(!result)return [];const next=await client.events(result.run.id);setEvents(next);return next}),[attempt,client,result])
  const reset=useCallback(()=>{setResult(null);setEvents([]);setError(null);setPending(false)},[])
  return {run,stream,approve,reject,cancel,refreshEvents,reset,result,events,pending,error}
}

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
