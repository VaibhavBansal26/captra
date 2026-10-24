import { describe,expect,it } from 'vitest'
import { z } from 'zod'
import { createStructuredGenerator,normalizeStructuredText,StructuredOutputError } from './models.js'

describe('structured model output',()=>{
  it('normalizes fenced JSON',()=>{expect(normalizeStructuredText('```json\n{"ok":true}\n```')).toBe('{"ok":true}')})

  it('requests a native schema and repairs once',async()=>{const requests:any[]=[];const generate=createStructuredGenerator({generate:async request=>{requests.push(request);return {text:requests.length===1?'```json\n{"count":"wrong"}\n```':'{"count":2}'}}});await expect(generate(z.object({count:z.number()}),{messages:[{role:'user',content:'count'}]})).resolves.toEqual({count:2});expect(requests[0].output).toMatchObject({type:'json_schema',name:'captra_output',strict:true});expect(requests).toHaveLength(2);expect(requests[1].messages.at(-1)?.content).toContain('Repair')})

  it('returns a typed error after the bounded repair attempt',async()=>{const generate=createStructuredGenerator({generate:async()=>({text:'not json'})});const error=await generate(z.object({ok:z.boolean()}),{messages:[]}).catch(value=>value);expect(error).toBeInstanceOf(StructuredOutputError);expect(error).toMatchObject({code:'structured_output_failed',failure:'invalid_json',attempts:2})})
})
