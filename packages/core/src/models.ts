import type { ZodType } from 'zod'
import type { AgentApp, ExecutionIdentity } from './core'
import type { Plan, PlannerAdapter } from './planner'

export type ModelMessage={role:'system'|'user'|'assistant'|'tool';content:string;name?:string;toolCallId?:string;toolCalls?:readonly ModelToolCall[]}
export type ModelTool={name:string;description:string;inputSchema:unknown}
export type ModelToolCall={id:string;name:string;input:unknown}
export type ModelRequest={messages:readonly ModelMessage[];tools?:readonly ModelTool[];signal?:AbortSignal;temperature?:number;providerState?:unknown}
export type ModelResponse={text:string;toolCalls?:readonly ModelToolCall[];usage?:{inputTokens?:number;outputTokens?:number};model?:string;providerState?:unknown}
export interface ModelAdapter { generate(request:ModelRequest):Promise<ModelResponse>; stream?(request:ModelRequest):AsyncIterable<string> }
export type ModelRecording={id:string;request:ModelRequest;response:ModelResponse;createdAt:number}
export interface ModelRecordingStore{append(record:ModelRecording):Promise<void>;list():Promise<ModelRecording[]>}
export class InMemoryModelRecordingStore implements ModelRecordingStore{readonly records:ModelRecording[]=[];async append(record:ModelRecording){this.records.push(structuredClone(record))}async list(){return structuredClone(this.records)}}
export function recordModel(model:ModelAdapter,store:ModelRecordingStore):ModelAdapter{return {async generate(request){const response=await model.generate(request);await store.append({id:crypto.randomUUID(),request:safeClone(request),response:safeClone(response),createdAt:Date.now()});return response},stream:model.stream?.bind(model)}}
export function replayModel(recordings:readonly ModelRecording[],options:{strict?:boolean}={}):ModelAdapter{let index=0;return {async generate(request){const recording=recordings[index++];if(!recording)throw new Error('No recorded model response remains');if(options.strict&&stable(recording.request)!==stable(request))throw new Error(`Model replay request mismatch at call ${index}`);return structuredClone(recording.response)}}}

export function createStructuredGenerator(model:ModelAdapter){
  return async function generate<Output>(schema:ZodType<Output>,request:ModelRequest):Promise<Output>{
    const response=await model.generate({...request,messages:[...request.messages,{role:'system',content:'Return only valid JSON matching the requested schema.'}]})
    let value:unknown
    try{value=JSON.parse(response.text)}catch{throw new Error('Model returned invalid JSON')}
    return schema.parse(value)
  }
}

function safeClone<T>(value:T):T{try{return structuredClone(value)}catch{return JSON.parse(JSON.stringify(value)) as T}}
function stable(value:unknown):string{if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;if(value&&typeof value==='object')return `{${Object.entries(value).filter(([,item])=>typeof item!=='function').sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;return JSON.stringify(value)}

export function createModelPlanner(model:ModelAdapter,identity?:Partial<ExecutionIdentity>):PlannerAdapter{
  return {async plan(prompt:string,app:AgentApp):Promise<Plan>{
    const capabilities=app.capabilities.map(({name,description})=>({name,description}))
    const response=await model.generate({messages:[
      {role:'system',content:`Select one capability and return JSON: {"capability":string,"input":object,"reason":string}. Available: ${JSON.stringify(capabilities)}`},
      {role:'user',content:prompt},
    ]})
    let plan:unknown
    try{plan=JSON.parse(response.text)}catch{throw new Error('Planner returned invalid JSON')}
    if(!plan||typeof plan!=='object')throw new Error('Planner returned an invalid plan')
    const candidate=plan as Record<string,unknown>
    if(typeof candidate.capability!=='string'||!app.capabilities.some(item=>item.name===candidate.capability))throw new Error('Planner selected an unknown capability')
    return {capability:candidate.capability,input:candidate.input,reason:typeof candidate.reason==='string'?candidate.reason:`Planned for ${identity?.userId??'current user'}`}
  }}
}
