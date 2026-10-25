import {Client} from '@modelcontextprotocol/client'
import {InMemoryTransport} from '@modelcontextprotocol/server'
import {capability,capabilityViews,createRuntime,defineApp,type ExecutionIdentity} from '@captra-ai/core'
import {afterEach,describe,expect,it} from 'vitest'
import {z} from 'zod'
import {createCaptraMcpServer,identityFromMcpAuth,importMcpTools} from './index.js'

const requester:ExecutionIdentity={tenantId:'acme',userId:'requester',projectId:'support'},approver:ExecutionIdentity={tenantId:'acme',userId:'approver',projectId:'support'}
function runtime(){const refund=capability({name:'refund.order',description:'Refund an order.',input:z.object({orderId:z.string()}),output:z.object({refunded:z.boolean()}),memory:['user'],state:{writes:['order/:orderId'],locks:['order/:orderId']},permissions:['refund:write'],approval:'required',idempotent:true,budget:{maxTokens:500,maxCostUsd:.02},run:async()=>({refunded:true}),view:{name:'RefundCard'}});return createRuntime(defineApp({name:'Commerce',version:'1.0.0',scopes:['user'],capabilities:[refund],surface:capabilityViews()}))}

describe('@captra-ai/mcp',()=>{
  const close: Array<()=>Promise<void>>=[]
  afterEach(async()=>{await Promise.all(close.splice(0).map(item=>item()))})

  it('exposes governed capability contracts and approval lifecycle',async()=>{let identity=requester;const server=createCaptraMcpServer(runtime(),{resolveIdentity:()=>identity}),client=new Client({name:'test',version:'1.0.0'}),[clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();await Promise.all([server.connect(serverTransport),client.connect(clientTransport)]);close.push(()=>client.close(),()=>server.close())
    const listed=await client.listTools(),refund=listed.tools.find(tool=>tool.name==='refund.order');expect(refund?._meta?.['captra/contract']).toMatchObject({permissions:['refund:write'],approval:'required',budget:{maxTokens:500,maxCostUsd:.02},view:'RefundCard',state:{locks:['order/:orderId']}})
    const started=await client.callTool({name:'refund.order',arguments:{orderId:'o1'}});expect(started.structuredContent).toMatchObject({status:'approval_required',capability:'refund.order'});const runId=(started.structuredContent as {runId:string}).runId
    identity=approver;const approved=await client.callTool({name:'captra.run.approve',arguments:{runId,decision:'approved'}});expect(approved.structuredContent).toMatchObject({status:'completed',value:{refunded:true}})
    const manifest=await client.readResource({uri:'captra://manifest'});expect(JSON.parse((manifest.contents[0] as {text:string}).text).capabilities[0]).toMatchObject({name:'refund.order',budget:{maxTokens:500}})
  })

  it('sanitizes public failures and keeps internal error correlation',async()=>{const errors:string[]=[];const server=createCaptraMcpServer(runtime(),{resolveIdentity:()=>requester,onError:(_,context)=>errors.push(context.requestId)}),client=new Client({name:'test',version:'1.0.0'}),[clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();await Promise.all([server.connect(serverTransport),client.connect(clientTransport)]);close.push(()=>client.close(),()=>server.close());const result=await client.callTool({name:'captra.run.status',arguments:{runId:'missing'}});expect(result.isError).toBe(true);expect((result.content[0] as {text:string}).text).toMatch(/^Captra request failed \([^)]+\)$/);expect(errors).toHaveLength(1)})

  it('imports remote tools with explicit side-effect policy',async()=>{const remote={listTools:async()=>({tools:[{name:'lookup',description:'Look up data',inputSchema:{type:'object'},annotations:{readOnlyHint:true}}]}),callTool:async()=>({content:[{type:'text' as const,text:'{"found":true}'}]}),close:async()=>{}};const [tool]=await importMcpTools(remote,{prefix:'remote',permissions:['remote:read']});expect(tool).toMatchObject({name:'remote.lookup',effect:'read',permissions:['remote:read'],mcp:{originalName:'lookup'}});expect(await tool.execute({},{} as never)).toEqual({found:true});await expect(importMcpTools({...remote,listTools:async()=>({tools:[{name:'write',inputSchema:{type:'object'}}]})})).rejects.toThrow('requires an idempotencyKey policy')})

  it('derives identity only from verified auth metadata',()=>{expect(identityFromMcpAuth({authInfo:{token:'hidden',clientId:'client',scopes:[],extra:{tenantId:'acme',projectId:'p1'}}})).toEqual({tenantId:'acme',userId:'client',projectId:'p1'});expect(()=>identityFromMcpAuth({})).toThrow('Authenticated MCP identity is required')})
})
