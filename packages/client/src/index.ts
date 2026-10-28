import { CAPTRA_PROTOCOL_VERSION, type AgentApp, type CaptraEvent, type CapabilityInput, type CapabilityName, type CapabilityOutput, type Conversation, type ConversationListPage, type ConversationMember, type ConversationPage, type ConversationStatus, type RemoteCapabilityResult, type RunRecord, type UsageGroupBy, type UsageQuery, type UsageRecord, type UsageSummary } from '@captra-ai/core'

export type CaptraClientOptions={baseUrl:string;headers?:HeadersInit;fetch?:typeof fetch}
export type RemoteResultFor<App extends AgentApp,Name extends CapabilityName<App>>=RemoteCapabilityResult<CapabilityOutput<App,Name>>&{capability:RemoteCapabilityResult['capability']&{name:Name}}
export type StreamMessage<Output=unknown>={event:'trace';data:CaptraEvent}|{event:'result';data:RemoteCapabilityResult<Output>}|{event:'error';data:{message:string;code?:string;requestId?:string}}
export class CaptraClientError extends Error{constructor(message:string,readonly status:number,readonly code?:string,readonly requestId?:string){super(message);this.name='CaptraClientError'}}

export function createCaptraClient<App extends AgentApp=AgentApp>(options:CaptraClientOptions){
  const request=options.fetch??globalThis.fetch
  const call=async(path:string,init?:RequestInit)=>{const response=await request(`${options.baseUrl.replace(/\/$/,'')}${path}`,{...init,headers:{'content-type':'application/json','captra-protocol':CAPTRA_PROTOCOL_VERSION,...options.headers,...init?.headers}});assertProtocol(response);const value=response.status===204?undefined:await response.json();if(!response.ok){const failure=(value??{}) as {error?:string;code?:string;requestId?:string};throw new CaptraClientError(failure.error??`Captra request failed: ${response.status}`,response.status,failure.code,failure.requestId??response.headers.get('x-request-id')??undefined)}return value}
  return {
    manifest:()=>call('/manifest'),
    execute:<Name extends CapabilityName<App>>(capability:Name,input:CapabilityInput<App,Name>,idempotencyKey?:string)=>call('/runs',{method:'POST',body:JSON.stringify({capability,input,idempotencyKey})}) as Promise<RemoteResultFor<App,Name>>,
    enqueue:<Name extends CapabilityName<App>>(capability:Name,input:CapabilityInput<App,Name>,options:{idempotencyKey?:string;maxAttempts?:number;availableAt?:number}={})=>call('/runs/queue',{method:'POST',body:JSON.stringify({capability,input,...options})}) as Promise<RunRecord>,
    run:(id:string)=>call(`/runs/${encodeURIComponent(id)}`) as Promise<RunRecord>,
    events:(id:string,after=0)=>call(`/runs/${encodeURIComponent(id)}/events?after=${after}`) as Promise<CaptraEvent[]>,
    conversationMessages:(id:string,options:{cursor?:string;limit?:number}={})=>call(`/conversations/${encodeURIComponent(id)}/messages?${usageParams(options)}`) as Promise<ConversationPage>,
    conversations:(options:{cursor?:string;limit?:number;status?:ConversationStatus}={})=>call(`/conversations?${usageParams(options)}`) as Promise<ConversationListPage>,
    conversation:(id:string)=>call(`/conversations/${encodeURIComponent(id)}`) as Promise<Conversation>,
    updateConversation:(id:string,patch:{title?:string|null;labels?:readonly string[]})=>call(`/conversations/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify(patch)}) as Promise<Conversation>,
    archiveConversation:(id:string)=>call(`/conversations/${encodeURIComponent(id)}/archive`,{method:'POST'}) as Promise<Conversation>,
    restoreConversation:(id:string)=>call(`/conversations/${encodeURIComponent(id)}/restore`,{method:'POST'}) as Promise<Conversation>,
    deleteConversation:(id:string)=>call(`/conversations/${encodeURIComponent(id)}`,{method:'DELETE'}).then(()=>undefined) as Promise<void>,
    conversationMembers:(id:string)=>call(`/conversations/${encodeURIComponent(id)}/members`) as Promise<ConversationMember[]>,
    shareConversation:(id:string,userId:string,role:'editor'|'viewer')=>call(`/conversations/${encodeURIComponent(id)}/members`,{method:'POST',body:JSON.stringify({userId,role})}) as Promise<ConversationMember>,
    unshareConversation:(id:string,userId:string)=>call(`/conversations/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`,{method:'DELETE'}).then(()=>undefined) as Promise<void>,
    transferConversation:(id:string,userId:string)=>call(`/conversations/${encodeURIComponent(id)}/transfer`,{method:'POST',body:JSON.stringify({userId})}) as Promise<Conversation>,
    replay:(id:string)=>call(`/runs/${encodeURIComponent(id)}/replay`) as Promise<{run:RunRecord;events:CaptraEvent[];checkpoints:Array<{id:string;runId:string;key:string;sequence:number;state:unknown;createdAt:number}>}>,
    approve:(id:string)=>call(`/runs/${encodeURIComponent(id)}/approve`,{method:'POST'}) as Promise<RemoteCapabilityResult>,
    async *approveStream(id:string,signal?:AbortSignal):AsyncIterable<StreamMessage>{const response=await request(`${options.baseUrl.replace(/\/$/,'')}/runs/${encodeURIComponent(id)}/approve/stream`,{method:'POST',headers:{accept:'text/event-stream','captra-protocol':CAPTRA_PROTOCOL_VERSION,...options.headers},signal});yield* readStream(response)},
    reject:(id:string)=>call(`/runs/${encodeURIComponent(id)}/reject`,{method:'POST'}) as Promise<RemoteCapabilityResult>,
    cancel:(id:string)=>call(`/runs/${encodeURIComponent(id)}/cancel`,{method:'POST'}) as Promise<RunRecord>,
    usage:(groupBy:UsageGroupBy='capability',query:Omit<UsageQuery,'tenantId'>&{scope?:'user'|'tenant'}={})=>call(`/usage?${usageParams({...query,groupBy})}`) as Promise<{groupBy:UsageGroupBy;items:UsageSummary[]}>,
    usageRecords:(query:Omit<UsageQuery,'tenantId'>&{scope?:'user'|'tenant'}={})=>call(`/usage/records?${usageParams(query)}`) as Promise<UsageRecord[]>,
    async *stream<Name extends CapabilityName<App>>(capability:Name,input:CapabilityInput<App,Name>,idempotencyKey?:string,signal?:AbortSignal):AsyncIterable<StreamMessage<CapabilityOutput<App,Name>>>{
      const response=await request(`${options.baseUrl.replace(/\/$/,'')}/runs/stream`,{method:'POST',headers:{'content-type':'application/json',accept:'text/event-stream','captra-protocol':CAPTRA_PROTOCOL_VERSION,...options.headers},body:JSON.stringify({capability,input,idempotencyKey}),signal})
      yield* readStream<CapabilityOutput<App,Name>>(response)
    }
  }
}
export type CaptraClient<App extends AgentApp=AgentApp>=ReturnType<typeof createCaptraClient<App>>
function assertProtocol(response:Response){const protocol=response.headers.get('captra-protocol');if(protocol&&protocol!==CAPTRA_PROTOCOL_VERSION)throw new CaptraClientError(`Unsupported Captra protocol: ${protocol}`,426,'protocol_mismatch',response.headers.get('x-request-id')??undefined)}
async function* readStream<Output=unknown>(response:Response):AsyncIterable<StreamMessage<Output>>{assertProtocol(response);if(!response.ok||!response.body)throw new CaptraClientError(`Captra stream failed: ${response.status}`,response.status,undefined,response.headers.get('x-request-id')??undefined);const reader=response.body.pipeThrough(new TextDecoderStream()).getReader();let buffer='';for(;;){const {done,value}=await reader.read();buffer+=value??'';const frames=buffer.split('\n\n');buffer=frames.pop()??'';for(const frame of frames){const event=frame.match(/^event: (.+)$/m)?.[1] as StreamMessage['event']|undefined;const data=frame.match(/^data: (.+)$/m)?.[1];if(event&&data)yield {event,data:JSON.parse(data)} as StreamMessage<Output>}if(done)break}}
function usageParams(query:Record<string,unknown>){const params=new URLSearchParams();for(const [key,value] of Object.entries(query))if(value!==undefined)params.set(key,String(value));return params}
