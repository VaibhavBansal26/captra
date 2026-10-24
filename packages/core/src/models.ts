import { toJSONSchema,z,type ZodType } from 'zod'
import type { AgentApp, ExecutionIdentity } from './core.js'
import type { Plan, PlannerAdapter } from './planner.js'

export type ModelMessage={role:'system'|'user'|'assistant'|'tool';content:string;name?:string;toolCallId?:string;toolCalls?:readonly ModelToolCall[]}
export type ModelTool={name:string;description:string;inputSchema:unknown;strict?:boolean}
export type ModelToolCall={id:string;name:string;input:unknown}
export type ModelOutputFormat={type:'json_schema';name:string;schema:unknown;description?:string;strict?:boolean}
export type ModelRequest={messages:readonly ModelMessage[];tools?:readonly ModelTool[];output?:ModelOutputFormat;signal?:AbortSignal;temperature?:number;maxOutputTokens?:number;providerState?:unknown}
export type ModelUsage={inputTokens?:number;outputTokens?:number;cachedInputTokens?:number;reasoningTokens?:number;costUsd?:number}
export type ModelResponse={text:string;toolCalls?:readonly ModelToolCall[];usage?:ModelUsage;model?:string;providerState?:unknown}
export interface ModelAdapter { generate(request:ModelRequest):Promise<ModelResponse>; stream?(request:ModelRequest):AsyncIterable<string> }
export type ModelRecording={id:string;request:ModelRequest;response:ModelResponse;createdAt:number}
export interface ModelRecordingStore{append(record:ModelRecording):Promise<void>;list():Promise<ModelRecording[]>}
export class InMemoryModelRecordingStore implements ModelRecordingStore{readonly records:ModelRecording[]=[];async append(record:ModelRecording){this.records.push(structuredClone(record))}async list(){return structuredClone(this.records)}}
export function recordModel(model:ModelAdapter,store:ModelRecordingStore):ModelAdapter{return {async generate(request){const response=await model.generate(request);await store.append({id:crypto.randomUUID(),request:safeClone(request),response:safeClone(response),createdAt:Date.now()});return response},stream:model.stream?.bind(model)}}
export function replayModel(recordings:readonly ModelRecording[],options:{strict?:boolean}={}):ModelAdapter{let index=0;return {async generate(request){const recording=recordings[index++];if(!recording)throw new Error('No recorded model response remains');if(options.strict&&stable(recording.request)!==stable(request))throw new Error(`Model replay request mismatch at call ${index}`);return structuredClone(recording.response)}}}

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
