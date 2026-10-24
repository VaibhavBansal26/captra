import { z } from 'zod'
import { defineTool } from './tools.js'

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

export const fetchJsonTool=defineTool({
  name:'http.fetchJson',description:'Call an HTTP JSON endpoint',permissions:['network:http'],
  input:z.object({url:z.url(),method:z.enum(['GET','POST','PUT','PATCH','DELETE']).default('GET'),headers:z.record(z.string(),z.string()).default({}),body:z.unknown().optional()}),
  output:z.object({status:z.number(),ok:z.boolean(),data:z.unknown()}),
  execute:async({url,method,headers,body},context)=>{const response=await fetch(url,{method,headers:{accept:'application/json',...(body===undefined?{}:{'content-type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body),signal:context.signal});const text=await response.text();let data:unknown=text;try{data=text?JSON.parse(text):null}catch{}return {status:response.status,ok:response.ok,data}}
})

export const builtinTools=Object.freeze([rememberTool,recallTool,forgetTool,fetchJsonTool])
