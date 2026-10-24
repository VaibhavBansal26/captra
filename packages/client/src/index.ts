import type { CaptraEvent, CapabilityResult, RunRecord } from '@captra/core'

export type CaptraClientOptions={baseUrl:string;headers?:HeadersInit;fetch?:typeof fetch}
export type StreamMessage={event:'trace';data:CaptraEvent}|{event:'result';data:CapabilityResult}|{event:'error';data:{message:string}}

export function createCaptraClient(options:CaptraClientOptions){
  const request=options.fetch??globalThis.fetch
  const call=async(path:string,init?:RequestInit)=>{const response=await request(`${options.baseUrl.replace(/\/$/,'')}${path}`,{...init,headers:{'content-type':'application/json',...options.headers,...init?.headers}});const value=await response.json();if(!response.ok)throw new Error((value as {error?:string}).error??`Captra request failed: ${response.status}`);return value}
  return {
    manifest:()=>call('/manifest'),
    execute:(capability:string,input:unknown,idempotencyKey?:string)=>call('/runs',{method:'POST',body:JSON.stringify({capability,input,idempotencyKey})}) as Promise<CapabilityResult>,
    enqueue:(capability:string,input:unknown,options:{idempotencyKey?:string;maxAttempts?:number;availableAt?:number}={})=>call('/runs/queue',{method:'POST',body:JSON.stringify({capability,input,...options})}) as Promise<RunRecord>,
    run:(id:string)=>call(`/runs/${encodeURIComponent(id)}`) as Promise<RunRecord>,
    events:(id:string,after=0)=>call(`/runs/${encodeURIComponent(id)}/events?after=${after}`) as Promise<CaptraEvent[]>,
    replay:(id:string)=>call(`/runs/${encodeURIComponent(id)}/replay`) as Promise<{run:RunRecord;events:CaptraEvent[];checkpoints:Array<{id:string;runId:string;key:string;sequence:number;state:unknown;createdAt:number}>}>,
    approve:(id:string)=>call(`/runs/${encodeURIComponent(id)}/approve`,{method:'POST'}) as Promise<CapabilityResult>,
    reject:(id:string)=>call(`/runs/${encodeURIComponent(id)}/reject`,{method:'POST'}) as Promise<CapabilityResult>,
    cancel:(id:string)=>call(`/runs/${encodeURIComponent(id)}/cancel`,{method:'POST'}) as Promise<RunRecord>,
    async *stream(capability:string,input:unknown,idempotencyKey?:string):AsyncIterable<StreamMessage>{
      const response=await request(`${options.baseUrl.replace(/\/$/,'')}/runs/stream`,{method:'POST',headers:{'content-type':'application/json',accept:'text/event-stream',...options.headers},body:JSON.stringify({capability,input,idempotencyKey})})
      if(!response.ok||!response.body)throw new Error(`Captra stream failed: ${response.status}`)
      const reader=response.body.pipeThrough(new TextDecoderStream()).getReader();let buffer=''
      for(;;){const {done,value}=await reader.read();buffer+=value??'';const frames=buffer.split('\n\n');buffer=frames.pop()??'';for(const frame of frames){const event=frame.match(/^event: (.+)$/m)?.[1] as StreamMessage['event']|undefined;const data=frame.match(/^data: (.+)$/m)?.[1];if(event&&data)yield {event,data:JSON.parse(data)} as StreamMessage}if(done)break}
    }
  }
}
export type CaptraClient=ReturnType<typeof createCaptraClient>
