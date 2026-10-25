import {Client,StreamableHTTPClientTransport,type CallToolResult as McpClientResult,type StreamableHTTPClientTransportOptions,type Tool as McpTool} from '@modelcontextprotocol/client'
import {createMcpHandler,McpServer,type AuthInfo,type CallToolResult as McpServerResult,type McpHttpHandler,type McpRequestContext} from '@modelcontextprotocol/server'
import {compileManifest,defineTool,type ExecutionIdentity,type Runtime,type RuntimeContext,type Tool} from '@captra-ai/core'
import {toJSONSchema,z} from 'zod'

export type McpClientLike=Pick<Client,'listTools'|'callTool'|'close'>
export type ImportedMcpTool=Tool<Record<string,unknown>,unknown>&{readonly mcp:{readonly originalName:string;readonly inputSchema:unknown;readonly outputSchema?:unknown}}
export type ImportMcpToolsOptions={prefix?:string;permissions?:readonly string[];effect?:(tool:McpTool)=>'read'|'write';idempotencyKey?:(tool:McpTool,input:Record<string,unknown>,context:RuntimeContext)=>string}

/** Discover remote MCP tools and adapt them to Captra's permission and effect runtime. */
export async function importMcpTools(client:McpClientLike,options:ImportMcpToolsOptions={}):Promise<ImportedMcpTool[]>{
  const {tools}=await client.listTools(),prefix=options.prefix?.replace(/\.$/,'')
  return tools.map(remote=>{
    const effect=options.effect?.(remote)??(remote.annotations?.readOnlyHint===true?'read':'write')
    if(effect==='write'&&!options.idempotencyKey)throw new Error(`Remote write tool ${remote.name} requires an idempotencyKey policy`)
    const definition={name:prefix?`${prefix}.${remote.name}`:remote.name,description:remote.description??`MCP tool ${remote.name}`,input:z.record(z.string(),z.unknown()),output:z.unknown(),permissions:options.permissions??[],effect,
      ...(effect==='write'?{idempotencyKey:(input:Record<string,unknown>,context:RuntimeContext)=>options.idempotencyKey!(remote,input,context)}:{}),
      async execute(input:Record<string,unknown>){const result=await client.callTool({name:remote.name,arguments:input});if(result.isError)throw new McpToolError(remote.name,textFrom(result));return outputFrom(result)}}
    return Object.freeze({...defineTool(definition),mcp:Object.freeze({originalName:remote.name,inputSchema:remote.inputSchema,...(remote.outputSchema?{outputSchema:remote.outputSchema}:{})})}) as ImportedMcpTool
  })
}

export class McpToolError extends Error{readonly code='mcp_tool_failed';constructor(readonly tool:string,message:string){super(message||`MCP tool ${tool} failed`);this.name='McpToolError'}}

export async function connectMcpHttp(url:string|URL,options:{name?:string;version?:string;transport?:StreamableHTTPClientTransportOptions}={}){
  const client=new Client({name:options.name??'captra',version:options.version??'1.0.0'}),transport=new StreamableHTTPClientTransport(new URL(url),options.transport)
  await client.connect(transport)
  return {client,transport,async close(){await transport.terminateSession();await client.close()}}
}

export type CaptraMcpIdentityContext={authInfo?:AuthInfo;request?:Request}
export type CaptraMcpServerOptions={name?:string;version?:string;resolveIdentity:(context:CaptraMcpIdentityContext)=>ExecutionIdentity|Promise<ExecutionIdentity>;onError?:(error:unknown,context:{operation:string;requestId:string})=>void|Promise<void>}

/** Build one MCP server instance exposing capability contracts and run lifecycle tools. */
export function createCaptraMcpServer(runtime:Runtime,options:CaptraMcpServerOptions,requestContext:Pick<McpRequestContext,'authInfo'|'requestInfo'>={}):McpServer{
  const server=new McpServer({name:options.name??runtime.app.name,version:options.version??runtime.app.version}),manifest=compileManifest(runtime.app)
  server.registerResource('captra-contract','captra://manifest',{title:`${runtime.app.name} capability contract`,description:'Schemas, permissions, memory, state, approval, budget, retry, idempotency, and UI metadata for every Captra capability.',mimeType:'application/json'},async uri=>({contents:[{uri:uri.href,mimeType:'application/json',text:JSON.stringify(manifest)}]}))
  for(const capability of runtime.app.capabilities){
    const contract={kind:'captra-capability',mode:capability.mode,permissions:capability.permissions,memory:capability.scopes,state:capability.state,approval:capability.approval,budget:capability.budget??{},policy:capability.policy,idempotent:capability.idempotent,view:capability.view.name,input:toJSONSchema(capability.input),output:toJSONSchema(capability.output)}
    server.registerTool(capability.name,{title:capability.name,description:capability.description,inputSchema:capability.input,annotations:{idempotentHint:capability.idempotent},_meta:{'captra/contract':contract,'captra/resultSchema':toJSONSchema(resultSchema)}},async input=>guard(options,capability.name,async()=>{
      const identity=await options.resolveIdentity({authInfo:requestContext.authInfo,request:requestContext.requestInfo}),result=await runtime.execute({capability:capability.name,input,identity})
      if(result.run.status==='waiting_for_approval')return response({status:'approval_required',runId:result.run.id,capability:capability.name,approval:{requester:result.run.identity,selfApprovalAllowed:typeof capability.approval==='object'&&capability.approval.allowRequester===true}})
      return response({status:'completed',runId:result.run.id,capability:capability.name,value:result.value,view:capability.view.name})
    }))
  }
  registerLifecycle(server,runtime,options,requestContext)
  return server
}

/** Create a web-standard Streamable HTTP MCP handler with per-request identity isolation. */
export function createCaptraMcpHandler(runtime:Runtime,options:CaptraMcpServerOptions):McpHttpHandler{return createMcpHandler(context=>createCaptraMcpServer(runtime,options,context))}

/** Resolve Captra identity only from verified MCP auth metadata. */
export function identityFromMcpAuth(context:CaptraMcpIdentityContext):ExecutionIdentity{
  const auth=context.authInfo,extra=auth?.extra;if(!auth)throw new Error('Authenticated MCP identity is required')
  const tenantId=string(extra?.tenantId),userId=string(extra?.userId)??auth.clientId,projectId=string(extra?.projectId)
  if(!tenantId||!userId||!projectId)throw new Error('Verified MCP auth must provide tenantId, userId, and projectId')
  return {tenantId,userId,projectId,...(string(extra?.sessionId)?{sessionId:string(extra?.sessionId)}:{})}
}

const resultSchema=z.object({status:z.enum(['completed','approval_required','cancelled']),runId:z.string(),capability:z.string(),value:z.unknown().optional(),view:z.string().optional(),approval:z.unknown().optional()})
function registerLifecycle(server:McpServer,runtime:Runtime,options:CaptraMcpServerOptions,requestContext:Pick<McpRequestContext,'authInfo'|'requestInfo'>){
  const context=()=>({authInfo:requestContext.authInfo,request:requestContext.requestInfo})
  server.registerTool('captra.run.status',{description:'Read the durable status and trace of a Captra run.',inputSchema:z.object({runId:z.string()}),annotations:{readOnlyHint:true,idempotentHint:true},_meta:{'captra/lifecycle':'status'}},async({runId})=>guard(options,'captra.run.status',async()=>{const identity=await options.resolveIdentity(context()),replay=await runtime.replay(runId);assertTenant(identity,replay.run.identity);return response({status:replay.run.status,runId,capability:replay.run.capability,value:replay.run.output,trace:replay.events})}))
  server.registerTool('captra.run.approve',{description:'Approve or reject a pending Captra run using an independent verified approver identity.',inputSchema:z.object({runId:z.string(),decision:z.enum(['approved','rejected'])}),annotations:{idempotentHint:true},_meta:{'captra/lifecycle':'approval','captra/selfApprovalDefault':'deny'}},async({runId,decision})=>guard(options,'captra.run.approve',async()=>{const approver=await options.resolveIdentity(context()),result=await runtime.approve(runId,decision,approver);return response({status:result.run.status,runId,capability:result.run.capability,value:result.value})}))
  server.registerTool('captra.run.cancel',{description:'Cancel a Captra run and propagate cancellation to active model and tool calls.',inputSchema:z.object({runId:z.string()}),annotations:{idempotentHint:true},_meta:{'captra/lifecycle':'cancel'}},async({runId})=>guard(options,'captra.run.cancel',async()=>{const identity=await options.resolveIdentity(context()),existing=await runtime.replay(runId);assertTenant(identity,existing.run.identity);const run=await runtime.cancel(runId);return response({status:'cancelled',runId,capability:run.capability})}))
}
async function guard(options:CaptraMcpServerOptions,operation:string,run:()=>Promise<McpServerResult>):Promise<McpServerResult>{try{return await run()}catch(error){const requestId=crypto.randomUUID();await options.onError?.(error,{operation,requestId});return {isError:true,content:[{type:'text' as const,text:`Captra request failed (${requestId})`}]}}}
function response(value:Record<string,unknown>):McpServerResult{return {content:[{type:'text' as const,text:JSON.stringify(value)}],structuredContent:value as never}}
function outputFrom(result:McpClientResult){if(result.structuredContent!==undefined)return result.structuredContent;const text=textFrom(result);if(!text)return result.content;try{return JSON.parse(text)}catch{return text}}
function textFrom(result:McpClientResult){return result.content.filter((item):item is Extract<(typeof result.content)[number],{type:'text'}>=>item.type==='text').map(item=>item.text).join('\n')}
function assertTenant(left:ExecutionIdentity,right:ExecutionIdentity){if(left.tenantId!==right.tenantId)throw new Error('Run does not belong to the authenticated tenant')}
function string(value:unknown){return typeof value==='string'&&value?value:undefined}
