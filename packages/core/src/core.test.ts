import { describe,expect,it } from 'vitest'
import { z } from 'zod'
import { capability,capabilityViews,createRuntime,defineApp,MemoryStore } from './index'

const identity={tenantId:'acme',userId:'u1',projectId:'support'}
const refund=capability({name:'refund',description:'Issue a refund',input:z.object({amount:z.number().positive()}),output:z.object({ok:z.boolean()}),memory:['user','project'],permissions:['refund:create'],approval:'required',idempotent:true,run:async()=>({ok:true}),view:{name:'RefundCard'}})
const app=defineApp({name:'Billing',scopes:['user','project'],capabilities:[refund],surface:capabilityViews()})

describe('@captra/core',()=>{
  it('pauses and resumes capability execution',async()=>{const runtime=createRuntime(app,{authorize:()=>true});const pending=await runtime.execute({capability:'refund',input:{amount:48},identity,idempotencyKey:'refund-1'});expect(pending.run.status).toBe('waiting_for_approval');const done=await runtime.approve(pending.run.id,'approved');expect(done.run.status).toBe('completed');expect(done.value).toEqual({ok:true})})
  it('enforces authorization centrally',async()=>{const runtime=createRuntime(app,{authorize:()=>false});await expect(runtime.execute({capability:'refund',input:{amount:48},identity})).rejects.toThrow('Not authorized')})
  it('isolates tenant memory',()=>{const memory=new MemoryStore([{id:'m1',tenantId:'other',scope:'user',ownerId:'u1',type:'fact',content:'private',confidence:1,createdAt:1}]);expect(memory.recall(['user'],identity)).toEqual([])})
})
