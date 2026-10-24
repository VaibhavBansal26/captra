import type { ZodType } from 'zod'
import type { AgentApp, ExecutionIdentity } from './core'
import type { Plan, PlannerAdapter } from './planner'

export type ModelMessage={role:'system'|'user'|'assistant'|'tool';content:string;name?:string;toolCallId?:string;toolCalls?:readonly ModelToolCall[]}
export type ModelTool={name:string;description:string;inputSchema:unknown}
export type ModelToolCall={id:string;name:string;input:unknown}
export type ModelRequest={messages:readonly ModelMessage[];tools?:readonly ModelTool[];signal?:AbortSignal;temperature?:number}
export type ModelResponse={text:string;toolCalls?:readonly ModelToolCall[];usage?:{inputTokens?:number;outputTokens?:number};model?:string}
export interface ModelAdapter { generate(request:ModelRequest):Promise<ModelResponse>; stream?(request:ModelRequest):AsyncIterable<string> }

export function createStructuredGenerator(model:ModelAdapter){
  return async function generate<Output>(schema:ZodType<Output>,request:ModelRequest):Promise<Output>{
    const response=await model.generate({...request,messages:[...request.messages,{role:'system',content:'Return only valid JSON matching the requested schema.'}]})
    let value:unknown
    try{value=JSON.parse(response.text)}catch{throw new Error('Model returned invalid JSON')}
    return schema.parse(value)
  }
}

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
