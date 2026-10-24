import { capability,type CapabilityViewProps } from 'captra'
import { z } from 'zod'

const HelloResult=z.object({message:z.string(),remembered:z.boolean()})
type HelloResult=z.infer<typeof HelloResult>

export function HelloCard({value}:CapabilityViewProps<HelloResult>){return <article className="result"><span>CAPABILITY COMPLETED</span><h2>{value.message}</h2><p>{value.remembered?'Your preference was recalled.':'This is your first run.'}</p></article>}
HelloCard.displayName='HelloCard'

export const hello=capability({
  name:'hello',description:'Greet a person with scoped memory.',
  input:z.object({name:z.string().min(1)}),output:HelloResult,
  memory:['user'],approval:'never',
  async run({name},context){const remembered=context.memories.some(item=>item.content===name);if(!remembered)await context.memory.remember({tenantId:context.tenantId,scope:'user',ownerId:context.userId,type:'preference',content:name,confidence:1});return {message:`Hello ${name}`,remembered}},
  view:HelloCard,
})
