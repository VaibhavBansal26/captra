import { CAPTRA_PROTOCOL_VERSION, type AgentApp, type CaptraEvent, type CapabilityInput, type CapabilityName, type CapabilityOutput, type RemoteCapabilityResult, type RunRecord } from '@captra-ai/core'

export type CaptraClientOptions={baseUrl:string;headers?:HeadersInit;fetch?:typeof fetch}
export type RemoteResultFor<App extends AgentApp,Name extends CapabilityName<App>>=RemoteCapabilityResult<CapabilityOutput<App,Name>>&{capability:RemoteCapabilityResult['capability']&{name:Name}}
export type StreamMessage<Output=unknown>={event:'trace';data:CaptraEvent}|{event:'result';data:RemoteCapabilityResult<Output>}|{event:'error';data:{message:string}}
export class CaptraClientError extends Error{constructor(message:string,readonly status:number,readonly code?:string,readonly requestId?:string){super(message);this.name='CaptraClientError'}}

export function createCaptraClient<App extends AgentApp=AgentApp>(options:CaptraClientOptions){
  const request=options.fetch??globalThis.fetch
  const call=async(path:string,init?:RequestInit)=>{const response=await request(`${options.baseUrl.replace(/\/$/,'')}${path}`,{...init,headers:{'content-type':'application/json','captra-protocol':CAPTRA_PROTOCOL_VERSION,...options.headers,...init?.headers}});assertProtocol(response);const value=await response.json();if(!response.ok){const failure=value as {error?:string;code?:string;requestId?:string};throw new CaptraClientError(failure.error??`Captra request failed: ${response.status}`,response.status,failure.code,failure.requestId??response.headers.get('x-request-id')??undefined)}return value}
  return {
    manifest:()=>call('/manifest'),
    execute:<Name extends CapabilityName<App>>(capability:Name,input:CapabilityInput<App,Name>,idempotencyKey?:string)=>call('/runs',{method:'POST',body:JSON.stringify({capability,input,idempotencyKey})}) as Promise<RemoteResultFor<App,Name>>,
    enqueue:<Name extends CapabilityName<App>>(capability:Name,input:CapabilityInput<App,Name>,options:{idempotencyKey?:string;maxAttempts?:number;availableAt?:number}={})=>call('/runs/queue',{method:'POST',body:JSON.stringify({capability,input,...options})}) as Promise<RunRecord>,
    run:(id:string)=>call(`/runs/${encodeURIComponent(id)}`) as Promise<RunRecord>,
    events:(id:string,after=0)=>call(`/runs/${encodeURIComponent(id)}/events?after=${after}`) as Promise<CaptraEvent[]>,
    replay:(id:string)=>call(`/runs/${encodeURIComponent(id)}/replay`) as Promise<{run:RunRecord;events:CaptraEvent[];checkpoints:Array<{id:string;runId:string;key:string;sequence:number;state:unknown;createdAt:number}>}>,
    approve:(id:string)=>call(`/runs/${encodeURIComponent(id)}/approve`,{method:'POST'}) as Promise<RemoteCapabilityResult>,
    reject:(id:string)=>call(`/runs/${encodeURIComponent(id)}/reject`,{method:'POST'}) as Promise<RemoteCapabilityResult>,
    cancel:(id:string)=>call(`/runs/${encodeURIComponent(id)}/cancel`,{method:'POST'}) as Promise<RunRecord>,
    async *stream<Name extends CapabilityName<App>>(capability:Name,input:CapabilityInput<App,Name>,idempotencyKey?:string):AsyncIterable<StreamMessage<CapabilityOutput<App,Name>>>{
      const response=await request(`${options.baseUrl.replace(/\/$/,'')}/runs/stream`,{method:'POST',headers:{'content-type':'application/json',accept:'text/event-stream','captra-protocol':CAPTRA_PROTOCOL_VERSION,...options.headers},body:JSON.stringify({capability,input,idempotencyKey})})
      assertProtocol(response)
      if(!response.ok||!response.body)throw new CaptraClientError(`Captra stream failed: ${response.status}`,response.status,undefined,response.headers.get('x-request-id')??undefined)
      const reader=response.body.pipeThrough(new TextDecoderStream()).getReader();let buffer=''
      for(;;){const {done,value}=await reader.read();buffer+=value??'';const frames=buffer.split('\n\n');buffer=frames.pop()??'';for(const frame of frames){const event=frame.match(/^event: (.+)$/m)?.[1] as StreamMessage['event']|undefined;const data=frame.match(/^data: (.+)$/m)?.[1];if(event&&data)yield {event,data:JSON.parse(data)} as StreamMessage<CapabilityOutput<App,Name>>}if(done)break}
    }
  }
}
export type CaptraClient<App extends AgentApp=AgentApp>=ReturnType<typeof createCaptraClient<App>>
function assertProtocol(response:Response){const protocol=response.headers.get('captra-protocol');if(protocol&&protocol!==CAPTRA_PROTOCOL_VERSION)throw new CaptraClientError(`Unsupported Captra protocol: ${protocol}`,426,'protocol_mismatch',response.headers.get('x-request-id')??undefined)}
