import { z } from 'zod'
import { defineTool } from './tools.js'

export type HttpToolPolicy={
  /** Exact origins that the tool may contact, for example https://api.example.com. */
  allowedOrigins:readonly string[]
  /** Request implementation supplied by the host; defaults to global fetch. */
  fetch?:typeof fetch
  maxResponseBytes?:number
  allowHeaders?:readonly string[]
}

export class OutboundRequestError extends Error{
  readonly code='outbound_request_denied'
  constructor(message:string){super(message);this.name='OutboundRequestError'}
}

export const rememberTool=defineTool({
  name:'memory.remember',description:'Save a fact, preference, decision, or working state',
  input:z.object({scope:z.enum(['organization','user','project','session','task']),ownerId:z.string(),type:z.enum(['fact','preference','decision','working-state']),content:z.string().min(1),confidence:z.number().min(0).max(1).default(1)}),
  output:z.object({id:z.string(),saved:z.literal(true)}),
  execute:async(input,context)=>{const record=await context.memory.remember({...input,tenantId:context.tenantId});return {id:record.id,saved:true as const}}
})

export const recallTool=defineTool({
  name:'memory.recall',description:'Recall relevant memories available to the current identity',
  input:z.object({scopes:z.array(z.enum(['organization','user','project','session','task'])),query:z.string().optional(),limit:z.number().int().positive().max(100).default(20)}),
  output:z.object({items:z.array(z.object({id:z.string(),scope:z.string(),type:z.string(),content:z.string(),confidence:z.number()}))}),
  execute:async({scopes,query,limit},context)=>{const records=await context.memory.recall(scopes,context,{query,limit});return {items:records.map(({id,scope,type,content,confidence})=>({id,scope,type,content,confidence}))}}
})

export const forgetTool=defineTool({
  name:'memory.forget',description:'Delete a memory available to the current identity',
  input:z.object({id:z.string()}),output:z.object({forgotten:z.boolean()}),
  execute:async({id},context)=>({forgotten:context.memory.forget?await context.memory.forget(id,context):false})
})

export function createFetchJsonTool(policy:HttpToolPolicy){
  const origins=new Set(policy.allowedOrigins.map(normalizeOrigin)),maxBytes=policy.maxResponseBytes??1_000_000,allowedHeaders=new Set((policy.allowHeaders??[]).map(value=>value.toLowerCase())),request=policy.fetch??globalThis.fetch
  if(!origins.size)throw new Error('HTTP tool requires at least one allowed origin')
  if(!Number.isSafeInteger(maxBytes)||maxBytes<=0)throw new Error('maxResponseBytes must be a positive integer')
  return defineTool({
    name:'http.fetchJson',description:'Call an allowlisted HTTP JSON endpoint',permissions:['network:http'],
    input:z.object({url:z.url(),method:z.enum(['GET','POST','PUT','PATCH','DELETE']).default('GET'),headers:z.record(z.string(),z.string()).default({}),body:z.unknown().optional()}),
    output:z.object({status:z.number(),ok:z.boolean(),data:z.unknown()}),
    execute:async({url,method,headers,body},context)=>{
      const target=new URL(url);assertAllowedTarget(target,origins)
      const safeHeaders:Record<string,string>={accept:'application/json',...(body===undefined?{}:{'content-type':'application/json'})}
      for(const [name,value] of Object.entries(headers)){const normalized=name.toLowerCase();if(!allowedHeaders.has(normalized))throw new OutboundRequestError(`Header is not allowed: ${name}`);safeHeaders[normalized]=value}
      const response=await request(target,{method,headers:safeHeaders,body:body===undefined?undefined:JSON.stringify(body),signal:context.signal,redirect:'manual'})
      if(response.status>=300&&response.status<400)throw new OutboundRequestError('HTTP redirects are not followed')
      const declared=Number(response.headers.get('content-length')??0);if(declared>maxBytes)throw new OutboundRequestError(`HTTP response exceeds ${maxBytes} bytes`)
      const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.byteLength>maxBytes)throw new OutboundRequestError(`HTTP response exceeds ${maxBytes} bytes`)
      const text=new TextDecoder().decode(bytes);let data:unknown=text;try{data=text?JSON.parse(text):null}catch{}
      return {status:response.status,ok:response.ok,data}
    }
  })
}

function normalizeOrigin(value:string){const url=new URL(value);if(url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error(`Allowed origin must contain only scheme, host, and port: ${value}`);if(url.protocol!=='https:'&&url.protocol!=='http:')throw new Error(`Unsupported allowed origin protocol: ${url.protocol}`);return url.origin}
function assertAllowedTarget(url:URL,origins:Set<string>){if(url.protocol!=='https:'&&url.protocol!=='http:')throw new OutboundRequestError('Only HTTP and HTTPS URLs are allowed');if(url.username||url.password)throw new OutboundRequestError('URL credentials are not allowed');if(!origins.has(url.origin))throw new OutboundRequestError(`Origin is not allowed: ${url.origin}`)}

/** @deprecated Configure an allowlisted instance with createFetchJsonTool(). */
export const fetchJsonTool=defineTool({
  name:'http.fetchJson',description:'Disabled HTTP JSON endpoint; configure createFetchJsonTool()',permissions:['network:http'],
  input:z.object({url:z.url(),method:z.enum(['GET','POST','PUT','PATCH','DELETE']).default('GET'),headers:z.record(z.string(),z.string()).default({}),body:z.unknown().optional()}),
  output:z.object({status:z.number(),ok:z.boolean(),data:z.unknown()}),
  execute:async()=>{throw new OutboundRequestError('HTTP tool requires an explicit outbound policy')}
})

/** Network tools require an explicit policy and are intentionally not enabled here. */
export const builtinTools=Object.freeze([rememberTool,recallTool,forgetTool])
