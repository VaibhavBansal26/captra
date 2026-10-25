import { describe,expect,it } from 'vitest'
import { z } from 'zod'
import { createModelFallback,createStructuredGenerator,ModelFallbackError,ModelProviderError,normalizeStructuredText,StructuredOutputError } from './models.js'

describe('structured model output',()=>{
  it('normalizes fenced JSON',()=>{expect(normalizeStructuredText('```json\n{"ok":true}\n```')).toBe('{"ok":true}')})

  it('requests a native schema and repairs once',async()=>{const requests:any[]=[];const generate=createStructuredGenerator({generate:async request=>{requests.push(request);return {text:requests.length===1?'```json\n{"count":"wrong"}\n```':'{"count":2}'}}});await expect(generate(z.object({count:z.number()}),{messages:[{role:'user',content:'count'}]})).resolves.toEqual({count:2});expect(requests[0].output).toMatchObject({type:'json_schema',name:'captra_output',strict:true});expect(requests).toHaveLength(2);expect(requests[1].messages.at(-1)?.content).toContain('Repair')})

  it('returns a typed error after the bounded repair attempt',async()=>{const generate=createStructuredGenerator({generate:async()=>({text:'not json'})});const error=await generate(z.object({ok:z.boolean()}),{messages:[]}).catch(value=>value);expect(error).toBeInstanceOf(StructuredOutputError);expect(error).toMatchObject({code:'structured_output_failed',failure:'invalid_json',attempts:2})})
})

describe('model provider fallback',()=>{
  it('retries, falls back, aggregates billed usage, and keeps the selected provider sticky',async()=>{let primaryCalls=0,secondaryState:unknown;const model=createModelFallback([{name:'primary',retries:1,model:{generate:async()=>{primaryCalls++;throw new ModelProviderError('busy',{status:503,retryable:true,usage:{inputTokens:3,costUsd:.01}})}}},{name:'secondary',model:{generate:async request=>{secondaryState=request.providerState;return {text:'ok',model:'backup',usage:{inputTokens:5,outputTokens:2,costUsd:.02},providerState:{cursor:1}}}}}]);const first=await model.generate({messages:[]});expect(first.provider).toBe('secondary');expect(first.usage).toEqual({inputTokens:11,outputTokens:2,costUsd:.04});expect(first.attempts?.map(item=>[item.provider,item.status])).toEqual([['primary','failed'],['primary','failed'],['secondary','succeeded']]);await model.generate({messages:[],providerState:first.providerState});expect(primaryCalls).toBe(2);expect(secondaryState).toEqual({cursor:1})})

  it('does not retry or fall back for terminal provider errors',async()=>{let backupCalls=0;const model=createModelFallback([{name:'primary',retries:2,model:{generate:async()=>{throw new ModelProviderError('invalid schema',{status:400,retryable:false,code:'invalid_request'})}}},{name:'backup',model:{generate:async()=>{backupCalls++;return {text:'unsafe'}}}}]);const error=await model.generate({messages:[]}).catch(value=>value);expect(error).toBeInstanceOf(ModelFallbackError);expect(error.attempts).toHaveLength(1);expect(backupCalls).toBe(0)})

  it('aborts timed-out providers before falling back even when an adapter ignores cancellation',async()=>{let aborted=false;const slow={generate:(request:any)=>new Promise<any>(()=>request.signal.addEventListener('abort',()=>{aborted=true},{once:true}))},model=createModelFallback([{name:'slow',timeoutMs:5,model:slow},{name:'fast',model:{generate:async()=>({text:'done'})}}]);await expect(model.generate({messages:[]})).resolves.toMatchObject({text:'done',provider:'fast'});expect(aborted).toBe(true)})

  it('opens a provider circuit after the configured failure threshold',async()=>{let primaryCalls=0;const model=createModelFallback([{name:'primary',model:{generate:async()=>{primaryCalls++;throw new ModelProviderError('busy',{status:503,retryable:true})}}},{name:'backup',model:{generate:async()=>({text:'done'})}}],{circuitBreaker:{failureThreshold:1,cooldownMs:60_000}});await model.generate({messages:[]});const second=await model.generate({messages:[]});expect(primaryCalls).toBe(1);expect(second.attempts?.[0]).toMatchObject({provider:'primary',status:'skipped',code:'circuit_open'})})
})
