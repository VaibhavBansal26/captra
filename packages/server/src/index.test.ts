import { describe,expect,it } from 'vitest'
import { z } from 'zod'
import { capability,capabilityViews,createRuntime,defineApp } from '@captra/core'
import { createCaptraHandler } from './index'

const work=capability({name:'work',description:'Do work',input:z.object({value:z.string()}),output:z.object({value:z.string()}),approval:'never',policy:{retries:1},run:async input=>input,view:{name:'Result'}})
const runtime=createRuntime(defineApp({name:'Test',scopes:[],capabilities:[work],surface:capabilityViews()}))
const handler=createCaptraHandler(runtime,{auth:async request=>({tenantId:request.headers.get('x-tenant')??'acme',userId:'u1',projectId:'p1'})})

describe('@captra/server',()=>{
  it('streams trace events and a final result',async()=>{const response=await handler(new Request('http://captra.test/runs/stream',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({capability:'work',input:{value:'ok'}})}));expect(response.headers.get('content-type')).toBe('text/event-stream');const body=await response.text();expect(body).toContain('event: trace');expect(body).toContain('event: result');expect(body).toContain('run.completed')})
  it('does not expose runs across tenants',async()=>{const created=await handler(new Request('http://captra.test/runs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({capability:'work',input:{value:'private'}})}));const result=await created.json() as {run:{id:string}};const response=await handler(new Request(`http://captra.test/runs/${result.run.id}`,{headers:{'x-tenant':'other'}}));expect(response.status).toBe(400);expect(await response.json()).toEqual({error:'Run not found'})})
})
