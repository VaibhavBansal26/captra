import type { ZodType } from 'zod'
import type { RuntimeContext } from './core'

export type ToolContext=RuntimeContext
export type Tool<Input,Output>={
  readonly kind:'tool'
  readonly name:string
  readonly description:string
  readonly input:ZodType<Input>
  readonly output:ZodType<Output>
  readonly permissions:readonly string[]
  readonly execute:(input:Input,context:ToolContext)=>Promise<Output>
}

export function defineTool<Input,Output>(definition:Omit<Tool<Input,Output>,'kind'|'permissions'>&{permissions?:readonly string[]}):Tool<Input,Output>{
  return Object.freeze({kind:'tool' as const,permissions:definition.permissions??[],...definition})
}

export type ToolCall={name:string;input:unknown}
export interface ToolRunner { call<Output=unknown>(name:string,input:unknown):Promise<Output> }

export function createToolRunner(tools:readonly Tool<any,any>[],context:RuntimeContext,authorize?:(permissions:readonly string[])=>Promise<boolean>):ToolRunner{
  const registry=new Map(tools.map(tool=>[tool.name,tool]))
  return {async call<Output>(name:string,input:unknown){
    const tool=registry.get(name)
    if(!tool)throw new Error(`Unknown tool: ${name}`)
    if(authorize&&!(await authorize(tool.permissions)))throw new Error(`Not authorized to call ${name}`)
    const parsed=tool.input.parse(input)
    await context.emit({type:'tool.started',capability:name,detail:tool.description,data:{input:parsed}})
    try{
      const value=tool.output.parse(await tool.execute(parsed,context))
      await context.emit({type:'tool.completed',capability:name,detail:'Tool call completed'})
      return value as Output
    }catch(error){
      await context.emit({type:'tool.failed',capability:name,detail:error instanceof Error?error.message:'Tool call failed'})
      throw error
    }
  }}
}
