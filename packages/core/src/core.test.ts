import { describe,expect,it } from 'vitest'
import { z } from 'zod'
import { capability,capabilityViews,createRuntime,createStructuredGenerator,defineApp,defineTool,MemoryStore } from './index'

const identity={tenantId:'acme',userId:'u1',projectId:'support'}
const refund=capability({name:'refund',description:'Issue a refund',input:z.object({amount:z.number().positive()}),output:z.object({ok:z.boolean()}),memory:['user','project'],permissions:['refund:create'],approval:'required',idempotent:true,run:async()=>({ok:true}),view:{name:'RefundCard'}})
const app=defineApp({name:'Billing',scopes:['user','project'],capabilities:[refund],surface:capabilityViews()})

describe('@captra/core',()=>{
  it('pauses and resumes capability execution',async()=>{const runtime=createRuntime(app,{authorize:()=>true});const pending=await runtime.execute({capability:'refund',input:{amount:48},identity,idempotencyKey:'refund-1'});expect(pending.run.status).toBe('waiting_for_approval');const done=await runtime.approve(pending.run.id,'approved');expect(done.run.status).toBe('completed');expect(done.value).toEqual({ok:true})})
  it('enforces authorization centrally',async()=>{const runtime=createRuntime(app,{authorize:()=>false});await expect(runtime.execute({capability:'refund',input:{amount:48},identity})).rejects.toThrow('Not authorized')})
  it('isolates tenant memory',()=>{const memory=new MemoryStore([{id:'m1',tenantId:'other',scope:'user',ownerId:'u1',type:'fact',content:'private',confidence:1,createdAt:1}]);expect(memory.recall(['user'],identity)).toEqual([])})
  it('validates and traces tool calls',async()=>{const upper=defineTool({name:'text.upper',description:'Uppercase text',input:z.object({text:z.string()}),output:z.object({text:z.string()}),execute:async({text})=>({text:text.toUpperCase()})});const work=capability({name:'work',description:'Use a tool',input:z.object({text:z.string()}),output:z.object({text:z.string()}),approval:'never',run:async(input,context)=>context.tools.call('text.upper',input),view:{name:'Result'}});const toolApp=defineApp({name:'Tools',scopes:[],capabilities:[work],tools:[upper],surface:capabilityViews()});const result=await createRuntime(toolApp).execute({capability:'work',input:{text:'captra'},identity});expect(result.value).toEqual({text:'CAPTRA'});expect(result.trace.map(event=>event.type)).toContain('tool.completed')})
  it('validates structured model output',async()=>{const generate=createStructuredGenerator({generate:async()=>({text:'{"answer":42}'})});await expect(generate(z.object({answer:z.number()}),{messages:[]})).resolves.toEqual({answer:42})})
})
