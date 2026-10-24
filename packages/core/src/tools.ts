import type { ZodType } from 'zod'
import type { RuntimeContext } from './core.js'
import { EffectInDoubtError } from './effects.js'

export type ToolContext=RuntimeContext
export type Tool<Input,Output>={
  readonly kind:'tool'
  readonly name:string
  readonly description:string
  readonly input:ZodType<Input>
  readonly output:ZodType<Output>
  readonly permissions:readonly string[]
  readonly effect:'read'|'write'
  readonly idempotencyKey?:(input:Input,context:ToolContext)=>string
  readonly execute:(input:Input,context:ToolContext)=>Promise<Output>
}

export function defineTool<Input,Output>(definition:Omit<Tool<Input,Output>,'kind'|'permissions'|'effect'>&{permissions?:readonly string[];effect?:'read'|'write'}):Tool<Input,Output>{
  if(definition.effect==='write'&&!definition.idempotencyKey)throw new Error(`Write tool ${definition.name} requires idempotencyKey`)
  return Object.freeze({kind:'tool' as const,permissions:definition.permissions??[],effect:definition.effect??'read',...definition})
}

export type ToolCall={name:string;input:unknown}
export interface ToolRunner { call<Output=unknown>(name:string,input:unknown):Promise<Output> }
export type ToolLifecycle={before?:(name:string,input:unknown,context:RuntimeContext)=>Promise<unknown>;after?:(name:string,output:unknown,context:RuntimeContext)=>Promise<unknown>;error?:(name:string,error:unknown,context:RuntimeContext)=>Promise<void>}

export function createToolRunner(tools:readonly Tool<any,any>[],context:RuntimeContext,authorize?:(permissions:readonly string[])=>Promise<boolean>,lifecycle:ToolLifecycle={}):ToolRunner{
  const registry=new Map(tools.map(tool=>[tool.name,tool]))
  return {async call<Output>(name:string,input:unknown){
    const tool=registry.get(name)
    if(!tool)throw new Error(`Unknown tool: ${name}`)
    if(authorize&&!(await authorize(tool.permissions)))throw new Error(`Not authorized to call ${name}`)
    let parsed:unknown=tool.input.parse(input);if(lifecycle.before)parsed=tool.input.parse(await lifecycle.before(name,parsed,context))
    const span=context.telemetry.startSpan('captra.tool',{runId:context.runId,tool:name,tenantId:context.tenantId}),startedAt=Date.now();await context.emit({type:'tool.started',capability:name,detail:tool.description,data:{input:parsed}})
    try{
      let value:unknown
      if(tool.effect==='write'){
        const key=tool.idempotencyKey!(parsed,context),claim=await context.effects.claim(context.tenantId,tool.name,key)
        if(claim.status==='completed')value=tool.output.parse(claim.output)
        else if(claim.status==='in_doubt')throw new EffectInDoubtError(claim.receipt)
        else try{value=tool.output.parse(await tool.execute(parsed,context));await context.effects.complete(context.tenantId,tool.name,key,value)}catch(error){await context.effects.doubt(context.tenantId,tool.name,key,error instanceof Error?error.message:'Tool effect failed');throw error}
      }else value=tool.output.parse(await tool.execute(parsed,context))
      if(lifecycle.after)value=tool.output.parse(await lifecycle.after(name,value,context))
      await context.emit({type:'tool.completed',capability:name,detail:'Tool call completed'});span.setAttribute('status','completed');span.end();context.telemetry.histogram?.('captra.tool.duration',Date.now()-startedAt,{tool:name,status:'completed'})
      return value as Output
    }catch(error){
      await lifecycle.error?.(name,error,context);await context.emit({type:'tool.failed',capability:name,detail:error instanceof Error?error.message:'Tool call failed'});span.setAttribute('status','failed');span.end(error);context.telemetry.counter?.('captra.tool.failures',1,{tool:name})
      throw error
    }
  }}
}
