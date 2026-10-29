import { describe,expect,it } from 'vitest'
import { capabilityViews,createRuntime,defineApp } from './core.js'
import { chat } from './chat.js'
import { InMemoryConversationStore } from './conversations.js'
import { OrderedRunCompletionStore } from './completion.js'
import { InMemoryRunStore } from './stores.js'
import { InMemoryUsageStore } from './usage.js'

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
  it('compacts token-heavy history while preserving auditable messages',async()=>{let calls=0;const model={generate:async()=>({text:++calls===1?'answer':'summary',provider:'test',model:'tiny'})},durable=chat({name:'compact.chat',description:'Compact chat',instructions:'Answer.',durable:true,model,compaction:{thresholdTokens:1,retainRecentMessages:1,promptVersion:'summary-v1'}}),runtime=createRuntime(defineApp({name:'Compact',scopes:[],capabilities:[durable],surface:capabilityViews()}));await runtime.conversations.append('c1',identity,[{id:'m1',role:'user',content:'old question'},{id:'m2',role:'assistant',content:'old answer'}]);const result=await runtime.execute({capability:'compact.chat',input:{conversationId:'c1',messages:[{id:'m3',role:'user',content:'new question'}]},identity});expect(result.trace.some(event=>event.type==='conversation.compacted')).toBe(true);expect((await runtime.conversations.summaries('c1',identity))[0]).toMatchObject({sourceMessageIds:['m1','m2'],model:'tiny',promptVersion:'summary-v1'});expect((await runtime.conversations.list('c1',identity,{limit:100})).items).toHaveLength(4)})

  it('does not mark a run completed when its assistant message cannot persist',async()=>{
    const durable=chat({name:'durable.chat',description:'Durable chat',instructions:'Answer.',durable:true,model:{generate:async()=>({text:'reply'})}}),runs=new InMemoryRunStore(),usage=new InMemoryUsageStore(),conversations=new InMemoryConversationStore()
    await conversations.append('c1',identity,[{id:'seed',role:'user',content:'seed'}]);await conversations.archive('c1',identity)
    const runtime=createRuntime(defineApp({name:'Durable',scopes:[],capabilities:[durable],surface:capabilityViews()}),{runs,usage,conversations})
    let runId='';await expect(runtime.execute({capability:'durable.chat',input:{conversationId:'c1',messages:[]},identity,onEvent:event=>{runId=event.runId}})).rejects.toThrow('archived')
    expect((await runs.get(runId))?.status).toBe('failed');expect(await usage.query({tenantId:'acme'})).toEqual([])
  })

  it('recovers a successful result when the commit response is lost after persistence',async()=>{
    const basic=chat({name:'basic.chat',description:'Basic chat',instructions:'Answer.',model:{generate:async()=>({text:'Done'})}}),runs=new InMemoryRunStore(),usage=new InMemoryUsageStore(),conversations=new InMemoryConversationStore(),delegate=new OrderedRunCompletionStore(runs,conversations,usage)
    const runtime=createRuntime(defineApp({name:'Chat',scopes:[],capabilities:[basic],surface:capabilityViews()}),{runs,usage,conversations,completion:{commit:async write=>{await delegate.commit(write);throw new Error('connection lost after commit')}}})
    const result=await runtime.execute({capability:'basic.chat',input:{messages:[{role:'user',content:'Go'}]},identity})
    expect(result.run.status).toBe('completed');expect(result.value.message.content).toBe('Done');expect((await runs.events(result.run.id)).filter(event=>event.type==='run.completed')).toHaveLength(1);expect(await usage.query({tenantId:'acme'})).toHaveLength(1)
  })
})
