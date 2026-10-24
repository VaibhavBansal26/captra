import { describe,expect,it } from 'vitest'
import { createRuntime,capabilityViews,defineApp } from 'captra'
import { hello } from './hello.js'

const runtime=createRuntime(defineApp({name:'Test',scopes:['user'],capabilities:[hello],surface:capabilityViews()}))
const identity={tenantId:'test',userId:'u1',projectId:'p1'}
describe('hello-ai',()=>{it('runs an agent, uses a tool, and recalls memory',async()=>{const first=await runtime.execute({capability:'hello-ai',input:{message:'I am building a fintech dashboard'},identity});expect(first.value).toMatchObject({provider:'demo',remembered:true});expect(first.trace.some(event=>event.type==='tool.completed')).toBe(true);const second=await runtime.execute({capability:'hello-ai',input:{message:'I am building a fintech dashboard'},identity});expect(second.value).toMatchObject({provider:'demo',remembered:true});expect(second.trace.some(event=>event.type==='memory.recalled'&&event.detail==='1 records')).toBe(true)})})
