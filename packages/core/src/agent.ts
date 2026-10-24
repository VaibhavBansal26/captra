import { toJSONSchema,type ZodType } from 'zod'
import { capability,type Capability,type ExecutionPolicy,type RuntimeContext,type ViewReference } from './core.js'
import type { MemoryScope } from './memory.js'
import type { ModelAdapter,ModelMessage,ModelResponse,ModelToolCall } from './models.js'
import type { Tool } from './tools.js'

export type AgentBudget={maxSteps?:number;maxToolCalls?:number;maxTokens?:number}
export type AgentDefinition<Input,Output,Name extends string=string>={
  name:Name;description:string;instructions:string;input:ZodType<Input>;output:ZodType<Output>;model:ModelAdapter
  tools?:readonly Tool<any,any>[];memory?:readonly MemoryScope[];permissions?:readonly string[];approval?:'never'|'required'
  idempotent?:boolean;policy?:ExecutionPolicy;budget?:AgentBudget;temperature?:number;view:ViewReference<Output>|unknown
}

export function agent<const Name extends string,Input,Output>(definition:AgentDefinition<Input,Output,Name>):Capability<Input,Output,Name>{
  const allowed=new Set((definition.tools??[]).map(tool=>tool.name)),tools=(definition.tools??[]).map(tool=>({name:tool.name,description:tool.description,inputSchema:toJSONSchema(tool.input)}))
  return capability({name:definition.name,description:definition.description,input:definition.input,output:definition.output,memory:definition.memory,permissions:definition.permissions,approval:definition.approval,idempotent:definition.idempotent,policy:definition.policy,tools:definition.tools,mode:'agent',view:definition.view,
    run:async(input,context)=>runAgent(definition,input,context,allowed,tools)})
}

async function runAgent<Input,Output>(definition:AgentDefinition<Input,Output>,input:Input,context:RuntimeContext,allowed:Set<string>,tools:{name:string;description:string;inputSchema:unknown}[]):Promise<Output>{
  const maxSteps=definition.budget?.maxSteps??8,maxToolCalls=definition.budget?.maxToolCalls??16,maxTokens=definition.budget?.maxTokens??50_000
  const memory=context.memories.length?`\nRelevant scoped memory:\n${context.memories.map(item=>`- [${item.type}] ${item.content}`).join('\n')}`:''
  const initial:AgentState={version:1,step:1,messages:[{role:'system',content:`${definition.instructions}${memory}\nWhen finished, return only JSON matching the required output schema: ${JSON.stringify(toJSONSchema(definition.output))}`},{role:'user',content:JSON.stringify(input)}],toolCalls:0,tokens:0}
  const key=`agent/${definition.name}/state`,restored=await context.checkpoints.load(key),state=isAgentState(restored?.state)?restored.state:initial
  for(;;){
    if(state.pending){
      for(let index=state.pending.next;index<state.pending.calls.length;index++){
        const call=state.pending.calls[index]
        if(!allowed.has(call.name))throw new Error(`Agent attempted unavailable tool: ${call.name}`)
        await context.emit({type:'agent.tool.selected',capability:definition.name,detail:call.name,data:{step:state.step,toolCallId:call.id}})
        const value=await context.tools.call(call.name,call.input);state.toolCalls++
        state.messages.push({role:'tool',name:call.name,toolCallId:call.id,content:JSON.stringify(value)});state.pending.next=index+1
        await context.checkpoints.save(key,state)
      }
      state.pending=undefined;state.step++;await context.checkpoints.save(key,state);continue
    }
    if(state.step>maxSteps)throw new Error(`Agent step budget exceeded (${maxSteps})`)
    await context.emit({type:'agent.step',capability:definition.name,detail:`Agent step ${state.step}`,data:{step:state.step,maxSteps,toolCalls:state.toolCalls,tokens:state.tokens}})
    const modelSpan=context.telemetry.startSpan('captra.model',{runId:context.runId,capability:definition.name,step:state.step}),modelStarted=Date.now();let response:ModelResponse
    try{response=await definition.model.generate({messages:state.messages,tools,signal:context.signal,temperature:definition.temperature,providerState:state.providerState});modelSpan.setAttribute('model',response.model);modelSpan.setAttribute('inputTokens',response.usage?.inputTokens);modelSpan.setAttribute('outputTokens',response.usage?.outputTokens);modelSpan.end();context.telemetry.histogram?.('captra.model.duration',Date.now()-modelStarted,{capability:definition.name,model:response.model});context.telemetry.counter?.('captra.model.tokens',(response.usage?.inputTokens??0)+(response.usage?.outputTokens??0),{capability:definition.name,model:response.model})}catch(error){modelSpan.end(error);context.telemetry.counter?.('captra.model.failures',1,{capability:definition.name});throw error}
    state.providerState=response.providerState
    state.tokens+=(response.usage?.inputTokens??0)+(response.usage?.outputTokens??0)
    if(state.tokens>maxTokens)throw new Error(`Agent token budget exceeded (${maxTokens})`)
    if(response.toolCalls?.length){
      if(state.toolCalls+response.toolCalls.length>maxToolCalls)throw new Error(`Agent tool-call budget exceeded (${maxToolCalls})`)
      state.messages.push({role:'assistant',content:response.text,toolCalls:response.toolCalls});state.pending={calls:[...response.toolCalls],next:0};await context.checkpoints.save(key,state)
      continue
    }
    let candidate:unknown
    try{candidate=JSON.parse(response.text)}catch{throw new Error('Agent returned invalid JSON output')}
    const output=definition.output.parse(candidate)
    await context.emit({type:'agent.completed',capability:definition.name,detail:`Completed in ${state.step} steps`,data:{steps:state.step,toolCalls:state.toolCalls,tokens:state.tokens,model:response.model}})
    return output
  }
}

type AgentState={version:1;step:number;messages:ModelMessage[];toolCalls:number;tokens:number;providerState?:unknown;pending?:{calls:ModelToolCall[];next:number}}
function isAgentState(value:unknown):value is AgentState{const state=value as Partial<AgentState>|undefined;return !!state&&state.version===1&&typeof state.step==='number'&&Array.isArray(state.messages)&&typeof state.toolCalls==='number'&&typeof state.tokens==='number'}
