import { describe,expect,it } from 'vitest'
import { capabilityViews,createRuntime,defineApp } from './core.js'
import { chat } from './chat.js'

const identity={tenantId:'acme',userId:'ada',projectId:'support'}

describe('chat capability',()=>{
  it('streams text through governed run events and commits usage',async()=>{
    const support=chat({name:'support.chat',description:'Support chat',instructions:'Be concise.',model:{generate:async()=>({text:'unused'}),async *stream(){yield {type:'text-delta' as const,delta:'Hello '};yield {type:'text-delta' as const,delta:'Ada'};yield {type:'finish' as const,response:{text:'Hello Ada',provider:'test',model:'tiny',usage:{inputTokens:8,outputTokens:2,costUsd:.001}}}}},budget:{maxTokens:100,maxOutputTokens:20},view:{name:'ChatMessage'}})
    const runtime=createRuntime(defineApp({name:'Chat',scopes:[],capabilities:[support],surface:capabilityViews()})),events:string[]=[]
    const result=await runtime.execute({capability:'support.chat',input:{messages:[{role:'user',content:'Hi'}]},identity,onEvent:event=>events.push(event.type)})
    expect(result.value.message).toMatchObject({role:'assistant',content:'Hello Ada'})
    expect(events.filter(type=>type==='chat.delta')).toHaveLength(2)
    expect(events).toEqual(expect.arrayContaining(['budget.reserved','budget.committed','run.completed']))
    expect(await runtime.usage.summarize({tenantId:'acme'},'provider')).toMatchObject([{key:'test',tokens:10,costUsd:.001}])
  })

  it('falls back to generate when the provider cannot stream',async()=>{
    const basic=chat({name:'basic.chat',description:'Basic chat',instructions:'Answer.',model:{generate:async()=>({text:'Done'})}}),runtime=createRuntime(defineApp({name:'Chat',scopes:[],capabilities:[basic],surface:capabilityViews()}))
    await expect(runtime.execute({capability:'basic.chat',input:{messages:[{role:'user',content:'Go'}]},identity})).resolves.toMatchObject({value:{message:{content:'Done'}}})
  })
  it('persists durable history and sends it to the next model call',async()=>{const requests:string[][]=[],durable=chat({name:'durable.chat',description:'Durable chat',instructions:'Answer.',durable:true,model:{generate:async request=>{requests.push(request.messages.map(message=>message.content));return {text:`reply-${requests.length}`}}}}),runtime=createRuntime(defineApp({name:'Durable',scopes:[],capabilities:[durable],surface:capabilityViews()}));const first=await runtime.execute({capability:'durable.chat',input:{conversationId:'c1',messages:[{id:'u1',role:'user',content:'first'}]},identity}),second=await runtime.execute({capability:'durable.chat',input:{conversationId:'c1',messages:[{id:'u2',role:'user',content:'second'}]},identity});expect(first.value.conversationId).toBe('c1');expect(second.value.message.content).toBe('reply-2');expect(requests[1]).toEqual(['Answer.','first','reply-1','second']);expect((await runtime.conversations.list('c1',identity)).items).toHaveLength(4)})
})
