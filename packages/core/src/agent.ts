import { toJSONSchema,type ZodType } from 'zod'
import { capability,type Capability,type ExecutionPolicy,type RuntimeContext,type ViewReference } from './core'
import type { MemoryScope } from './memory'
import type { ModelAdapter,ModelMessage } from './models'
import type { Tool } from './tools'

export type AgentBudget={maxSteps?:number;maxToolCalls?:number;maxTokens?:number}
export type AgentDefinition<Input,Output>={
  name:string;description:string;instructions:string;input:ZodType<Input>;output:ZodType<Output>;model:ModelAdapter
  tools?:readonly Tool<any,any>[];memory?:readonly MemoryScope[];permissions?:readonly string[];approval?:'never'|'required'
  idempotent?:boolean;policy?:ExecutionPolicy;budget?:AgentBudget;temperature?:number;view:ViewReference<Output>|unknown
}

export function agent<Input,Output>(definition:AgentDefinition<Input,Output>):Capability<Input,Output>{
  const allowed=new Set((definition.tools??[]).map(tool=>tool.name)),tools=(definition.tools??[]).map(tool=>({name:tool.name,description:tool.description,inputSchema:toJSONSchema(tool.input)}))
  return capability({name:definition.name,description:definition.description,input:definition.input,output:definition.output,memory:definition.memory,permissions:definition.permissions,approval:definition.approval,idempotent:definition.idempotent,policy:definition.policy,tools:definition.tools,mode:'agent',view:definition.view,
    run:async(input,context)=>runAgent(definition,input,context,allowed,tools)})
}

async function runAgent<Input,Output>(definition:AgentDefinition<Input,Output>,input:Input,context:RuntimeContext,allowed:Set<string>,tools:{name:string;description:string;inputSchema:unknown}[]):Promise<Output>{
  const maxSteps=definition.budget?.maxSteps??8,maxToolCalls=definition.budget?.maxToolCalls??16,maxTokens=definition.budget?.maxTokens??50_000
  const memory=context.memories.length?`\nRelevant scoped memory:\n${context.memories.map(item=>`- [${item.type}] ${item.content}`).join('\n')}`:''
  const messages:ModelMessage[]=[{role:'system',content:`${definition.instructions}${memory}\nWhen finished, return only JSON matching the required output schema: ${JSON.stringify(toJSONSchema(definition.output))}`},{role:'user',content:JSON.stringify(input)}]
  let toolCalls=0,tokens=0,providerState:unknown
  for(let step=1;step<=maxSteps;step++){
    await context.emit({type:'agent.step',capability:definition.name,detail:`Agent step ${step}`,data:{step,maxSteps,toolCalls,tokens}})
    const response=await definition.model.generate({messages,tools,signal:context.signal,temperature:definition.temperature,providerState})
    providerState=response.providerState
    tokens+=(response.usage?.inputTokens??0)+(response.usage?.outputTokens??0)
    if(tokens>maxTokens)throw new Error(`Agent token budget exceeded (${maxTokens})`)
    if(response.toolCalls?.length){
      if(toolCalls+response.toolCalls.length>maxToolCalls)throw new Error(`Agent tool-call budget exceeded (${maxToolCalls})`)
      messages.push({role:'assistant',content:response.text,toolCalls:response.toolCalls})
      for(const call of response.toolCalls){
        if(!allowed.has(call.name))throw new Error(`Agent attempted unavailable tool: ${call.name}`)
        await context.emit({type:'agent.tool.selected',capability:definition.name,detail:call.name,data:{step,toolCallId:call.id}})
        const value=await context.tools.call(call.name,call.input);toolCalls++
        messages.push({role:'tool',name:call.name,toolCallId:call.id,content:JSON.stringify(value)})
      }
      continue
    }
    let candidate:unknown
    try{candidate=JSON.parse(response.text)}catch{throw new Error('Agent returned invalid JSON output')}
    const output=definition.output.parse(candidate)
    await context.emit({type:'agent.completed',capability:definition.name,detail:`Completed in ${step} steps`,data:{steps:step,toolCalls,tokens,model:response.model}})
    return output
  }
  throw new Error(`Agent step budget exceeded (${maxSteps})`)
}
