import { toJSONSchema,z,type ZodType } from 'zod'
import type { AgentApp, ExecutionIdentity } from './core.js'
import type { Plan, PlannerAdapter } from './planner.js'

export type ModelMessage={role:'system'|'user'|'assistant'|'tool';content:string;name?:string;toolCallId?:string;toolCalls?:readonly ModelToolCall[]}
export type ModelTool={name:string;description:string;inputSchema:unknown;strict?:boolean}
export type ModelToolCall={id:string;name:string;input:unknown}
export type ModelOutputFormat={type:'json_schema';name:string;schema:unknown;description?:string;strict?:boolean}
export type ModelRequest={messages:readonly ModelMessage[];tools?:readonly ModelTool[];output?:ModelOutputFormat;signal?:AbortSignal;temperature?:number;maxOutputTokens?:number;providerState?:unknown}
export type ModelUsage={inputTokens?:number;outputTokens?:number;cachedInputTokens?:number;reasoningTokens?:number;costUsd?:number}
export type ModelAttempt={provider:string;attempt:number;status:'succeeded'|'failed'|'skipped';durationMs:number;retryable?:boolean;code?:string;model?:string;usage?:ModelUsage}
export type ModelResponse={text:string;toolCalls?:readonly ModelToolCall[];usage?:ModelUsage;model?:string;provider?:string;attempts?:readonly ModelAttempt[];providerState?:unknown}
export type ModelStreamEvent={type:'text-delta';delta:string}|{type:'finish';response:ModelResponse}
export interface ModelAdapter { generate(request:ModelRequest):Promise<ModelResponse>; stream?(request:ModelRequest):AsyncIterable<string|ModelStreamEvent> }
export type ModelRecording={id:string;request:ModelRequest;response:ModelResponse;createdAt:number}
export interface ModelRecordingStore{append(record:ModelRecording):Promise<void>;list():Promise<ModelRecording[]>}
export class InMemoryModelRecordingStore implements ModelRecordingStore{readonly records:ModelRecording[]=[];async append(record:ModelRecording){this.records.push(structuredClone(record))}async list(){return structuredClone(this.records)}}
export function recordModel(model:ModelAdapter,store:ModelRecordingStore):ModelAdapter{return {async generate(request){const response=await model.generate(request);await store.append({id:crypto.randomUUID(),request:safeClone(request),response:safeClone(response),createdAt:Date.now()});return response},stream:model.stream?.bind(model)}}
export function replayModel(recordings:readonly ModelRecording[],options:{strict?:boolean}={}):ModelAdapter{let index=0;return {async generate(request){const recording=recordings[index++];if(!recording)throw new Error('No recorded model response remains');if(options.strict&&stable(recording.request)!==stable(request))throw new Error(`Model replay request mismatch at call ${index}`);return structuredClone(recording.response)}}}

export class ModelProviderError extends Error{
  readonly code:string
  constructor(message:string,readonly options:{provider?:string;status?:number;retryable?:boolean;code?:string;usage?:ModelUsage;cause?:unknown}={}){super(message,{cause:options.cause});this.name='ModelProviderError';this.code=options.code??'model_provider_failed'}
}
export class ModelFallbackError extends Error{
  readonly code='model_fallback_exhausted'
  constructor(readonly attempts:readonly ModelAttempt[],readonly cause?:unknown){super('All model providers failed',{cause});this.name='ModelFallbackError'}
}
export type ModelFallbackProvider={name:string;model:ModelAdapter;retries?:number;timeoutMs?:number;retryDelayMs?:number}
export type ModelFallbackOptions={maxElapsedMs?:number;circuitBreaker?:{failureThreshold:number;cooldownMs:number};retry?:(error:unknown)=>boolean;now?:()=>number;sleep?:(milliseconds:number,signal?:AbortSignal)=>Promise<void>}

export function createModelFallback(providers:readonly ModelFallbackProvider[],options:ModelFallbackOptions={}):ModelAdapter{
  if(!providers.length)throw new Error('At least one model provider is required')
  if(new Set(providers.map(item=>item.name)).size!==providers.length)throw new Error('Model provider names must be unique')
  for(const provider of providers){if(provider.retries!==undefined&&(!Number.isSafeInteger(provider.retries)||provider.retries<0))throw new Error(`Provider retries must be a non-negative integer: ${provider.name}`);if(provider.timeoutMs!==undefined&&(!Number.isFinite(provider.timeoutMs)||provider.timeoutMs<=0))throw new Error(`Provider timeout must be positive: ${provider.name}`)}
  if(options.maxElapsedMs!==undefined&&(!Number.isFinite(options.maxElapsedMs)||options.maxElapsedMs<=0))throw new Error('maxElapsedMs must be positive')
  if(options.circuitBreaker&&(!Number.isSafeInteger(options.circuitBreaker.failureThreshold)||options.circuitBreaker.failureThreshold<=0||!Number.isFinite(options.circuitBreaker.cooldownMs)||options.circuitBreaker.cooldownMs<=0))throw new Error('Circuit breaker threshold and cooldown must be positive')
  const now=options.now??Date.now,sleep=options.sleep??delay,circuits=new Map<string,{failures:number;openUntil:number}>()
  return {async generate(request){
    const started=now(),attempts:ModelAttempt[]=[],previousState=isFallbackState(request.providerState)?request.providerState:undefined,sticky=previousState?providers.findIndex(item=>item.name===previousState.provider):-1,order=sticky>=0?[sticky,...providers.map((_,index)=>index).filter(index=>index!==sticky)]:providers.map((_,index)=>index)
    let lastError:unknown
    for(const index of order){
      const provider=providers[index],circuit=circuits.get(provider.name)
      if(circuit&&circuit.openUntil>now()){attempts.push({provider:provider.name,attempt:0,status:'skipped',durationMs:0,code:'circuit_open'});continue}
      for(let attempt=0;attempt<=(provider.retries??0);attempt++){
        if(request.signal?.aborted)throw request.signal.reason??new DOMException('Aborted','AbortError')
        if(options.maxElapsedMs!==undefined&&now()-started>=options.maxElapsedMs)throw new ModelFallbackError(attempts,new ModelProviderError('Model fallback deadline exceeded',{code:'model_deadline_exceeded',retryable:false}))
        const attemptStarted=now(),state=previousState?.provider===provider.name?previousState.state:undefined
        try{
          const response=await callProvider(provider.model,{...request,providerState:state},provider.timeoutMs)
          const record:ModelAttempt={provider:provider.name,attempt:attempt+1,status:'succeeded',durationMs:now()-attemptStarted,model:response.model,usage:response.usage};attempts.push(record);circuits.delete(provider.name)
          return {...response,provider:provider.name,attempts,usage:sumUsage(attempts),providerState:{__captraFallback:1,provider:provider.name,state:response.providerState} satisfies FallbackState}
        }catch(error){
          if(request.signal?.aborted||isAbort(error))throw error
          lastError=error;const retryable=options.retry?.(error)??isRetryableModelError(error),usage=error instanceof ModelProviderError?error.options.usage:undefined,code=error instanceof ModelProviderError?error.code:error instanceof ModelTimeoutError?error.code:'model_provider_failed'
          attempts.push({provider:provider.name,attempt:attempt+1,status:'failed',durationMs:now()-attemptStarted,retryable,code,usage})
          const failures=(circuits.get(provider.name)?.failures??0)+1,threshold=options.circuitBreaker?.failureThreshold??Number.POSITIVE_INFINITY
          circuits.set(provider.name,{failures,openUntil:failures>=threshold?now()+(options.circuitBreaker?.cooldownMs??0):0})
          if(!retryable)throw new ModelFallbackError(attempts,error)
          if(attempt<(provider.retries??0)){const wait=provider.retryDelayMs??0;if(wait)try{await sleepWithin(wait,started,options.maxElapsedMs,request.signal,sleep,now)}catch(delayError){if(request.signal?.aborted||isAbort(delayError))throw delayError;throw new ModelFallbackError(attempts,delayError)}continue}
        }
      }
    }
    throw new ModelFallbackError(attempts,lastError)
  }}
}
export const fallback=createModelFallback

class ModelTimeoutError extends ModelProviderError{constructor(milliseconds:number){super(`Model provider timed out after ${milliseconds}ms`,{code:'model_timeout',retryable:true});this.name='ModelTimeoutError'}}
type FallbackState={__captraFallback:1;provider:string;state?:unknown}
function isFallbackState(value:unknown):value is FallbackState{return !!value&&typeof value==='object'&&(value as FallbackState).__captraFallback===1&&typeof (value as FallbackState).provider==='string'}
function isRetryableModelError(error:unknown){return error instanceof ModelProviderError?error.options.retryable??(error.options.status===429||error.options.status===408||(error.options.status??0)>=500):true}
function isAbort(error:unknown){return error instanceof DOMException&&error.name==='AbortError'||error instanceof Error&&error.name==='AbortError'}
async function callProvider(model:ModelAdapter,request:ModelRequest,milliseconds?:number){if(milliseconds===undefined)return model.generate(request);const controller=new AbortController(),parent=request.signal,abort=()=>controller.abort(parent?.reason??new DOMException('Aborted','AbortError')),timer=setTimeout(()=>controller.abort(new ModelTimeoutError(milliseconds)),milliseconds),aborted=new Promise<never>((_,reject)=>controller.signal.addEventListener('abort',()=>reject(controller.signal.reason??new DOMException('Aborted','AbortError')),{once:true}));if(parent?.aborted)abort();else parent?.addEventListener('abort',abort,{once:true});try{return await Promise.race([model.generate({...request,signal:controller.signal}),aborted])}finally{clearTimeout(timer);parent?.removeEventListener('abort',abort)}}
function sumUsage(attempts:readonly ModelAttempt[]):ModelUsage|undefined{const usages=attempts.flatMap(item=>item.usage?[item.usage]:[]);if(!usages.length)return undefined;return {inputTokens:sum(usages,'inputTokens'),outputTokens:sum(usages,'outputTokens'),cachedInputTokens:sum(usages,'cachedInputTokens'),reasoningTokens:sum(usages,'reasoningTokens'),costUsd:sum(usages,'costUsd')}}
function sum(usages:readonly ModelUsage[],key:keyof ModelUsage){const values=usages.map(item=>item[key]).filter((value):value is number=>value!==undefined);return values.length?values.reduce((total,value)=>total+value,0):undefined}
async function sleepWithin(milliseconds:number,started:number,maxElapsed:number|undefined,signal:AbortSignal|undefined,sleep:(milliseconds:number,signal?:AbortSignal)=>Promise<void>,now:()=>number){const remaining=maxElapsed===undefined?milliseconds:Math.min(milliseconds,Math.max(0,maxElapsed-(now()-started)));if(remaining<=0)throw new ModelProviderError('Model fallback deadline exceeded',{code:'model_deadline_exceeded',retryable:false});await sleep(remaining,signal)}
function delay(milliseconds:number,signal?:AbortSignal){return new Promise<void>((resolve,reject)=>{const done=()=>{signal?.removeEventListener('abort',abort);resolve()},timer=setTimeout(done,milliseconds),abort=()=>{clearTimeout(timer);reject(signal?.reason??new DOMException('Aborted','AbortError'))};if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true})})}

export type StructuredOutputFailure='invalid_json'|'schema_mismatch'
export class StructuredOutputError extends Error{
  readonly code='structured_output_failed'
  constructor(readonly failure:StructuredOutputFailure,readonly attempts:number,readonly output:string,readonly details?:unknown){super(failure==='invalid_json'?'Model returned invalid JSON':'Model output did not match the schema');this.name='StructuredOutputError'}
}

export function normalizeStructuredText(text:string){const trimmed=text.trim(),match=trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/i);return (match?.[1]??trimmed).trim()}
export function parseStructuredOutput<Output>(schema:ZodType<Output>,text:string,attempts=1):Output{
  const normalized=normalizeStructuredText(text);let value:unknown
  try{value=JSON.parse(normalized)}catch(error){throw new StructuredOutputError('invalid_json',attempts,text,error)}
  const parsed=schema.safeParse(value);if(!parsed.success)throw new StructuredOutputError('schema_mismatch',attempts,text,parsed.error.issues)
  return parsed.data
}

export function createStructuredGenerator(model:ModelAdapter,options:{repairAttempts?:number}={}){
  return async function generate<Output>(schema:ZodType<Output>,request:ModelRequest):Promise<Output>{
    const output:ModelOutputFormat={type:'json_schema',name:'captra_output',schema:toJSONSchema(schema),strict:true},messages=[...request.messages,{role:'system' as const,content:`Return JSON matching this schema: ${JSON.stringify(output.schema)}`}],repairAttempts=options.repairAttempts??1
    let lastText=''
    for(let attempt=0;attempt<=repairAttempts;attempt++){
      const response=await model.generate({...request,output,messages:attempt===0?messages:[...messages,{role:'assistant',content:lastText},{role:'user',content:'Repair the previous response. Return only valid JSON matching the required schema.'}]});lastText=response.text
      try{return parseStructuredOutput(schema,response.text,attempt+1)}catch(error){if(!(error instanceof StructuredOutputError)||attempt>=repairAttempts)throw error}
    }
    throw new StructuredOutputError('invalid_json',repairAttempts+1,lastText)
  }
}

function safeClone<T>(value:T):T{try{return structuredClone(value)}catch{return JSON.parse(JSON.stringify(value)) as T}}
function stable(value:unknown):string{if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;if(value&&typeof value==='object')return `{${Object.entries(value).filter(([,item])=>typeof item!=='function').sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;return JSON.stringify(value)}

export function createModelPlanner(model:ModelAdapter,identity?:Partial<ExecutionIdentity>):PlannerAdapter{
  const generate=createStructuredGenerator(model),schema=z.object({capability:z.string(),input:z.unknown(),reason:z.string().optional()})
  return {async plan(prompt:string,app:AgentApp):Promise<Plan>{
    const capabilities=app.capabilities.map(({name,description})=>({name,description}))
    const candidate=await generate(schema,{messages:[
      {role:'system',content:`Select one available capability. Available: ${JSON.stringify(capabilities)}`},
      {role:'user',content:prompt},
    ]})
    if(!app.capabilities.some(item=>item.name===candidate.capability))throw new Error('Planner selected an unknown capability')
    return {capability:candidate.capability,input:candidate.input,reason:typeof candidate.reason==='string'?candidate.reason:`Planned for ${identity?.userId??'current user'}`}
  }}
}
