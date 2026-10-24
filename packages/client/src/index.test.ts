import { describe,expect,expectTypeOf,it } from 'vitest'
import { z } from 'zod'
import { capability,capabilityViews,defineApp } from '@captra/core'
import { createCaptraClient } from './index'

const greet=capability({name:'greet',description:'Greet someone',input:z.object({name:z.string()}),output:z.object({message:z.string()}),approval:'never',run:async({name})=>({message:`Hello ${name}`}),view:{name:'Greeting'}})
const app=defineApp({name:'Typed',scopes:[],capabilities:[greet],surface:capabilityViews()})

describe('@captra/client',()=>{
  it('infers capability input and output from the app contract',async()=>{
    let body:unknown
    const client=createCaptraClient<typeof app>({baseUrl:'https://captra.test',fetch:async(_url,init)=>{body=JSON.parse(String(init?.body));return Response.json({run:{id:'r1',status:'completed'},capability:{name:'greet',mode:'function',description:'Greet someone',view:'Greeting'},value:{message:'Hello Ada'},trace:[]})}})
    const result=await client.execute('greet',{name:'Ada'})
    expectTypeOf(result.value).toEqualTypeOf<{message:string}>()
    expect(result.value.message).toBe('Hello Ada')
    expect(body).toEqual({capability:'greet',input:{name:'Ada'}})
  })
})
