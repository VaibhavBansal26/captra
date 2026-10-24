import { createServer } from 'node:http'
import { once } from 'node:events'
import { afterEach,describe,expect,it } from 'vitest'
import { z } from 'zod'
import { capability,capabilityViews,createRuntime,defineApp } from '@captra-ai/core'
import { createCaptraHandler } from './index'
import { createNodeHandler } from './node'

const echo=capability({name:'echo',description:'Echo a value',input:z.object({value:z.string()}),output:z.object({value:z.string()}),approval:'never',run:async input=>input,view:{name:'Echo'}})
const runtime=createRuntime(defineApp({name:'Node test',scopes:[],capabilities:[echo],surface:capabilityViews()}))
const servers:Array<ReturnType<typeof createServer>>=[]
afterEach(async()=>{await Promise.all(servers.splice(0).map(server=>new Promise<void>(resolve=>server.close(()=>resolve()))))})

async function start(){const server=createServer(createNodeHandler(createCaptraHandler(runtime,{basePath:'/api/captra',auth:async()=>({tenantId:'acme',userId:'u1',projectId:'p1'})})));servers.push(server);server.listen(0,'127.0.0.1');await once(server,'listening');const address=server.address();if(!address||typeof address==='string')throw new Error('Missing test address');return `http://127.0.0.1:${address.port}`}

describe('@captra-ai/server/node',()=>{
  it('bridges Node requests and streaming response bodies',async()=>{const origin=await start();const manifest=await fetch(`${origin}/api/captra/manifest`);expect(manifest.status).toBe(200);expect((await manifest.json() as {name:string}).name).toBe('Node test');const run=await fetch(`${origin}/api/captra/runs`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({capability:'echo',input:{value:'node'}})});expect(run.status).toBe(202);expect((await run.json() as {value:{value:string}}).value.value).toBe('node')})
})
