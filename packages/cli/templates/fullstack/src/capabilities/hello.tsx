import { agent,defineTool,type CapabilityViewProps,type ModelAdapter } from 'captra'
import { createOpenAI } from 'captra/openai'
import { z } from 'zod'

const HelloResult=z.object({reply:z.string(),remembered:z.boolean(),provider:z.enum(['demo','openai'])})
type HelloResult=z.infer<typeof HelloResult>

const rememberContext=defineTool({name:'starter.remember',description:'Remember one useful fact about what the developer is building.',input:z.object({fact:z.string().min(1)}),output:z.object({saved:z.literal(true)}),async execute({fact},context){await context.memory.remember({tenantId:context.tenantId,scope:'user',ownerId:context.userId,type:'fact',content:fact,confidence:1});return {saved:true as const}}})
const demoModel:ModelAdapter={async generate(request){const user=[...request.messages].reverse().find(item=>item.role==='user'),input=JSON.parse(user?.content??'{}') as {message?:string},message=input.message??'Hello AI',system=request.messages.find(item=>item.role==='system')?.content??'',usedTool=request.messages.some(item=>item.role==='tool'),remembered=system.includes(message);if(!remembered&&!usedTool)return {text:'',model:'captra-demo',usage:{inputTokens:24,outputTokens:12},toolCalls:[{id:'remember-1',name:'starter.remember',input:{fact:message}}]};return {text:JSON.stringify({reply:`I’m running through Captra’s agent loop. A strong first feature for “${message}” is a typed assistant that remembers context and shows every tool call.`,remembered:remembered||usedTool,provider:'demo'}),model:'captra-demo',usage:{inputTokens:42,outputTokens:38}}}}
const environment=(globalThis as {process?:{env?:Record<string,string|undefined>}}).process?.env,provider=environment?.OPENAI_API_KEY&&environment.NODE_ENV!=='test'?'openai':'demo',model=provider==='openai'?createOpenAI({model:environment?.OPENAI_MODEL??'gpt-5-mini'}):demoModel

export function HelloCard({value}:CapabilityViewProps<HelloResult>){return <article className="result"><span>HELLO AI WORLD · {value.provider.toUpperCase()}</span><h2>{value.reply}</h2><p>{value.remembered?'Captra used or saved scoped memory for this run.':'No memory was needed.'}</p></article>}
HelloCard.displayName='HelloCard'
export const hello=agent({name:'hello-ai',description:'Run a real typed agent with scoped memory and an inspectable trace.',instructions:`You are the first Captra agent. Give one concise, useful suggestion based on the developer's message. If the exact message is not already in relevant memory, call starter.remember once. Return JSON with reply, remembered, and provider set to ${provider}.`,input:z.object({message:z.string().min(2)}),output:HelloResult,memory:['user'],tools:[rememberContext],budget:{maxSteps:3,maxToolCalls:1,maxTokens:1_200},approval:'never',model,view:HelloCard})
