import { describe,expect,expectTypeOf,it } from 'vitest'
import { z } from 'zod'
import { capability,capabilityViews,defineApp } from '@captra-ai/core'
import { CaptraClientError,createCaptraClient } from './index'

const greet=capability({name:'greet',description:'Greet someone',input:z.object({name:z.string()}),output:z.object({message:z.string()}),approval:'never',run:async({name})=>({message:`Hello ${name}`}),view:{name:'Greeting'}})
const app=defineApp({name:'Typed',scopes:[],capabilities:[greet],surface:capabilityViews()})

describe('@captra-ai/client',()=>{
  it('infers capability input and output from the app contract',async()=>{
    let body:unknown
    const client=createCaptraClient<typeof app>({baseUrl:'https://captra.test',fetch:async(_url,init)=>{body=JSON.parse(String(init?.body));expect(new Headers(init?.headers).get('captra-protocol')).toBe('1.0');return Response.json({run:{id:'r1',status:'completed'},capability:{name:'greet',mode:'function',description:'Greet someone',view:'Greeting'},value:{message:'Hello Ada'},trace:[]})}})
    const result=await client.execute('greet',{name:'Ada'})
    expectTypeOf(result.value).toEqualTypeOf<{message:string}>()
    expect(result.value.message).toBe('Hello Ada')
    expect(body).toEqual({capability:'greet',input:{name:'Ada'}})
  })
  it('exposes stable server failure metadata',async()=>{const client=createCaptraClient<typeof app>({baseUrl:'https://captra.test',fetch:async()=>Response.json({error:'Invalid input',code:'validation_failed',requestId:'req-1'},{status:422})});const failure=await client.execute('greet',{name:'Ada'}).catch(error=>error);expect(failure).toBeInstanceOf(CaptraClientError);expect(failure).toMatchObject({status:422,code:'validation_failed',requestId:'req-1'})})
  it('builds typed usage report queries',async()=>{let url='';const client=createCaptraClient<typeof app>({baseUrl:'https://captra.test',fetch:async input=>{url=String(input);return Response.json({groupBy:'provider',items:[]})}});await client.usage('provider',{scope:'tenant',from:100});expect(url).toBe('https://captra.test/usage?scope=tenant&from=100&groupBy=provider')})
  it('builds conversation pagination queries',async()=>{let url='';const client=createCaptraClient<typeof app>({baseUrl:'https://captra.test',fetch:async input=>{url=String(input);return Response.json({items:[]})}});await client.conversationMessages('thread/one',{cursor:'m1',limit:20});expect(url).toBe('https://captra.test/conversations/thread%2Fone/messages?cursor=m1&limit=20')})
  it('builds conversation lifecycle requests',async()=>{const calls:Array<{url:string;method?:string}>=[];const client=createCaptraClient<typeof app>({baseUrl:'https://captra.test',fetch:async(input,init)=>{calls.push({url:String(input),method:init?.method});return init?.method==='DELETE'?new Response(null,{status:204}):Response.json({id:'thread/one',status:'archived'})}});await client.archiveConversation('thread/one');await client.restoreConversation('thread/one');await client.deleteConversation('thread/one');expect(calls).toEqual([{url:'https://captra.test/conversations/thread%2Fone/archive',method:'POST'},{url:'https://captra.test/conversations/thread%2Fone/restore',method:'POST'},{url:'https://captra.test/conversations/thread%2Fone',method:'DELETE'}])})
})
