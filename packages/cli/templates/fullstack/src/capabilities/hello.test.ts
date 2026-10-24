import { describe,expect,it } from 'vitest'
import { createRuntime,capabilityViews,defineApp } from 'captra'
import { hello } from './hello.js'

const runtime=createRuntime(defineApp({name:'Test',scopes:['user'],capabilities:[hello],surface:capabilityViews()}))
const identity={tenantId:'test',userId:'u1',projectId:'p1'}
describe('hello',()=>{it('remembers the user between runs',async()=>{expect((await runtime.execute({capability:'hello',input:{name:'Ada'},identity})).value.remembered).toBe(false);expect((await runtime.execute({capability:'hello',input:{name:'Ada'},identity})).value.remembered).toBe(true)})})
