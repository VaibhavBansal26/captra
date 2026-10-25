import { CAPTRA_PROTOCOL_VERSION, compileManifest, type CapabilityResult, type CaptraEvent, type RemoteCapabilityResult, type RunRecord, type Runtime, type UsageGroupBy, type UsageQuery, type WorkQueue } from '@captra-ai/core'

export type AuthResolver=(request:Request)=>Promise<{tenantId:string;userId:string;projectId:string;sessionId?:string}>
export type CorsOptions={origins:'*'|readonly string[];methods?:readonly string[];headers?:readonly string[];credentials?:boolean;maxAge?:number}
export type RateLimitResult={allowed:boolean;limit:number;remaining:number;resetAt:number}
export interface RateLimitAdapter{consume(key:string,options:{limit:number;windowMs:number;now:number}):Promise<RateLimitResult>}
export type RateLimitOptions={limit:number;windowMs:number;adapter?:RateLimitAdapter;key?:(request:Request,identity:Awaited<ReturnType<AuthResolver>>)=>string}
export type CaptraServerError={requestId:string;request:Request;error:unknown;status:number;code:string}
export type CaptraHandlerOptions={auth:AuthResolver;queue?:WorkQueue;basePath?:string;maxBodyBytes?:number;cors?:CorsOptions;rateLimit?:RateLimitOptions;authorizeTenantUsage?:(identity:Awaited<ReturnType<AuthResolver>>)=>boolean|Promise<boolean>;onError?:(failure:CaptraServerError)=>void|Promise<void>}
export class CaptraHttpError extends Error{constructor(readonly status:number,readonly code:string,message:string){super(message);this.name='CaptraHttpError'}}
export class InMemoryRateLimitAdapter implements RateLimitAdapter{
  readonly #windows=new Map<string,{count:number;resetAt:number}>()
  async consume(key:string,{limit,windowMs,now}:{limit:number;windowMs:number;now:number}):Promise<RateLimitResult>{const existing=this.#windows.get(key),window=!existing||existing.resetAt<=now?{count:0,resetAt:now+windowMs}:existing;window.count++;this.#windows.set(key,window);return {allowed:window.count<=limit,limit,remaining:Math.max(0,limit-window.count),resetAt:window.resetAt}}
}
export type FetchHandler=(request:Request)=>Response|Promise<Response>
export type NextRoute={GET:FetchHandler;POST:FetchHandler;OPTIONS:FetchHandler}
export function createNextRoute(handler:FetchHandler):NextRoute{return Object.freeze({GET:handler,POST:handler,OPTIONS:handler})}
export type HonoContext={req:{raw:Request}}
export function createHonoHandler(handler:FetchHandler){return (context:HonoContext)=>handler(context.req.raw)}

export function createCaptraHandler(runtime:Runtime,options:CaptraHandlerOptions){
  const basePath=normalizeBasePath(options.basePath),maxBodyBytes=options.maxBodyBytes??1_000_000,rateLimitAdapter=options.rateLimit?.adapter??new InMemoryRateLimitAdapter()
  if(maxBodyBytes<=0)throw new Error('maxBodyBytes must be positive')
  if(options.rateLimit&&(options.rateLimit.limit<=0||!Number.isSafeInteger(options.rateLimit.limit)||options.rateLimit.windowMs<=0||!Number.isFinite(options.rateLimit.windowMs)))throw new Error('Rate limit and window must be positive')
  if(options.cors?.origins==='*'&&options.cors.credentials)throw new Error('CORS wildcard origins cannot be combined with credentials')
  return async(request:Request):Promise<Response>=>{
    const requestId=request.headers.get('x-request-id')??crypto.randomUUID(),origin=request.headers.get('origin')
    try{
      const route=resolveRoute(new URL(request.url).pathname,basePath)
      if(!route)throw new CaptraHttpError(404,'not_found','Not found')
      if(request.method==='OPTIONS')return decorate(new Response(null,{status:204}),requestId,origin,options.cors)
      const requestedProtocol=request.headers.get('captra-protocol')
      if(requestedProtocol&&requestedProtocol!==CAPTRA_PROTOCOL_VERSION)throw new CaptraHttpError(426,'protocol_mismatch',`Unsupported Captra protocol: ${requestedProtocol}`)
      if(request.method==='GET'&&route==='/manifest')return decorate(json(compileManifest(runtime.app)),requestId,origin,options.cors)
      let identity:Awaited<ReturnType<AuthResolver>>
      try{identity=await options.auth(request)}catch{throw new CaptraHttpError(401,'unauthorized','Authentication failed')}
      if(options.rateLimit){const key=options.rateLimit.key?.(request,identity)??`${identity.tenantId}:${identity.userId}`,decision=await rateLimitAdapter.consume(key,{limit:options.rateLimit.limit,windowMs:options.rateLimit.windowMs,now:Date.now()});if(!decision.allowed){const response=json({error:'Rate limit exceeded',code:'rate_limited',requestId},429);response.headers.set('retry-after',String(Math.max(1,Math.ceil((decision.resetAt-Date.now())/1000))));response.headers.set('ratelimit-limit',String(decision.limit));response.headers.set('ratelimit-remaining',String(decision.remaining));response.headers.set('ratelimit-reset',String(Math.ceil(decision.resetAt/1000)));return decorate(response,requestId,origin,options.cors)}}
      if(request.method==='GET'&&(route==='/usage'||route==='/usage/records')){const url=new URL(request.url),tenantScope=url.searchParams.get('scope')==='tenant';if(tenantScope&&!(await options.authorizeTenantUsage?.(identity)))throw new CaptraHttpError(403,'forbidden','Permission denied');const query=usageQuery(url,identity,tenantScope);if(route==='/usage/records')return decorate(json(await runtime.usage.query(query)),requestId,origin,options.cors);const groupBy=usageGroup(url.searchParams.get('groupBy'));return decorate(json({groupBy,items:await runtime.usage.summarize(query,groupBy)}),requestId,origin,options.cors)}
      if(request.method==='POST'&&route==='/runs/queue'){if(!options.queue)throw new CaptraHttpError(501,'queue_unavailable','Background queue is not configured');const body=await readJson<{capability:string;input:unknown;idempotencyKey?:string;maxAttempts?:number;availableAt?:number}>(request,maxBodyBytes);const {maxAttempts,availableAt,...run}=body;return decorate(json(await runtime.enqueue({...run,identity},options.queue,{maxAttempts,availableAt}),202),requestId,origin,options.cors)}
      if(request.method==='POST'&&route==='/runs/stream'){const body=await readJson<{capability:string;input:unknown;idempotencyKey?:string}>(request,maxBodyBytes);return decorate(streamRun(runtime,{...body,identity},requestId,request,options.onError),requestId,origin,options.cors)}
      if(request.method==='POST'&&route==='/runs'){const body=await readJson<{capability:string;input:unknown;idempotencyKey?:string}>(request,maxBodyBytes);return decorate(json(toRemoteResult(await runtime.execute({...body,identity})),202),requestId,origin,options.cors)}
      const approval=route.match(/^\/runs\/([^/]+)\/(approve|reject)$/)
      if(request.method==='POST'&&approval){await assertTenant(runtime,approval[1],identity);return decorate(json(toRemoteResult(await runtime.approve(approval[1],approval[2]==='approve'?'approved':'rejected',identity))),requestId,origin,options.cors)}
      const cancellation=route.match(/^\/runs\/([^/]+)\/cancel$/)
      if(request.method==='POST'&&cancellation){await assertOwner(runtime,cancellation[1],identity);return decorate(json(await runtime.cancel(cancellation[1])),requestId,origin,options.cors)}
      const events=route.match(/^\/runs\/([^/]+)\/events$/)
      if(request.method==='GET'&&events){await assertOwner(runtime,events[1],identity);return decorate(json((await runtime.runs.events(events[1],Number(new URL(request.url).searchParams.get('after')??0))).map(toPublicEvent)),requestId,origin,options.cors)}
      const replay=route.match(/^\/runs\/([^/]+)\/replay$/)
      if(request.method==='GET'&&replay){await assertOwner(runtime,replay[1],identity);const value=await runtime.replay(replay[1]);return decorate(json({...value,run:toPublicRun(value.run),events:value.events.map(toPublicEvent)}),requestId,origin,options.cors)}
      const run=route.match(/^\/runs\/([^/]+)$/)
      if(request.method==='GET'&&run){await assertOwner(runtime,run[1],identity);const value=await runtime.runs.get(run[1]);return decorate(json(value&&toPublicRun(value)),requestId,origin,options.cors)}
      throw new CaptraHttpError(404,'not_found','Not found')
    }catch(error){const failure=classifyError(error);await reportError(options.onError,{requestId,request,error,status:failure.status,code:failure.code});return decorate(json({error:failure.message,code:failure.code,requestId},failure.status),requestId,origin,options.cors)}
  }
}

function normalizeBasePath(value='/'){const path=`/${value}`.replace(/\/+/g,'/').replace(/\/$/,'');return path==='/'?'':path}
function resolveRoute(pathname:string,basePath:string){if(!basePath)return pathname.replace(/\/$/,'')||'/';if(pathname!==basePath&&!pathname.startsWith(`${basePath}/`))return null;return pathname.slice(basePath.length).replace(/\/$/,'')||'/'}
function usageGroup(value:string|null):UsageGroupBy{const group=value??'capability';if(!['run','capability','user','tenant','provider','model'].includes(group))throw new CaptraHttpError(400,'invalid_usage_group','Invalid usage group');return group as UsageGroupBy}
function usageQuery(url:URL,identity:Awaited<ReturnType<AuthResolver>>,tenantScope:boolean):UsageQuery{const number=(name:string)=>{const value=url.searchParams.get(name);if(value===null)return undefined;const parsed=Number(value);if(!Number.isFinite(parsed)||parsed<0)throw new CaptraHttpError(400,'invalid_usage_query',`Invalid usage ${name}`);return parsed};return {tenantId:identity.tenantId,userId:tenantScope?(url.searchParams.get('userId')??undefined):identity.userId,projectId:url.searchParams.get('projectId')??undefined,runId:url.searchParams.get('runId')??undefined,capability:url.searchParams.get('capability')??undefined,provider:url.searchParams.get('provider')??undefined,model:url.searchParams.get('model')??undefined,from:number('from'),to:number('to'),limit:number('limit')}}
async function readJson<T>(request:Request,maxBytes:number):Promise<T>{const declared=Number(request.headers.get('content-length')??0);if(declared>maxBytes)throw new CaptraHttpError(413,'body_too_large',`Request body exceeds ${maxBytes} bytes`);const text=await request.text();if(new TextEncoder().encode(text).byteLength>maxBytes)throw new CaptraHttpError(413,'body_too_large',`Request body exceeds ${maxBytes} bytes`);try{return JSON.parse(text) as T}catch{throw new CaptraHttpError(400,'invalid_json','Request body must be valid JSON')}}
async function assertOwner(runtime:Runtime,runId:string,identity:{tenantId:string;userId:string}){const run=await runtime.runs.get(runId);if(!run||run.identity.tenantId!==identity.tenantId||run.identity.userId!==identity.userId)throw new CaptraHttpError(404,'run_not_found','Run not found')}
async function assertTenant(runtime:Runtime,runId:string,identity:{tenantId:string}){const run=await runtime.runs.get(runId);if(!run||run.identity.tenantId!==identity.tenantId)throw new CaptraHttpError(404,'run_not_found','Run not found')}
function classifyError(error:unknown):CaptraHttpError{if(error instanceof CaptraHttpError)return error;if(error instanceof Error&&error.name==='ZodError')return new CaptraHttpError(422,'validation_failed','Request validation failed');if(error instanceof Error&&(/^(Not authorized|Requester cannot approve|Approver must belong)/.test(error.message)))return new CaptraHttpError(403,'forbidden','Permission denied');if(error instanceof Error&&(/is not waiting for approval|is no longer waiting for approval|cannot be cancelled/.test(error.message)))return new CaptraHttpError(409,'run_conflict','Run state conflict');if(error instanceof Error&&error.name==='EffectInDoubtError')return new CaptraHttpError(409,'effect_in_doubt','External effect requires reconciliation');if(error instanceof Error&&error.name==='RunCancelledError')return new CaptraHttpError(409,'run_cancelled','Run was cancelled');if(error instanceof Error&&error.name==='StructuredOutputError')return new CaptraHttpError(502,'model_output_invalid','Model returned invalid structured output');return new CaptraHttpError(500,'internal_error','Internal server error')}
async function reportError(handler:CaptraHandlerOptions['onError'],failure:CaptraServerError){try{await handler?.(failure)}catch{/* Error reporting must never replace the original response. */}}
function json(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json'}})}
function decorate(response:Response,requestId:string,origin:string|null,cors?:CorsOptions){response.headers.set('captra-protocol',CAPTRA_PROTOCOL_VERSION);response.headers.set('x-request-id',requestId);if(cors&&origin&&(cors.origins==='*'||cors.origins.includes(origin))){response.headers.set('access-control-allow-origin',cors.origins==='*'?'*':origin);response.headers.set('vary','Origin');response.headers.set('access-control-allow-methods',(cors.methods??['GET','POST','OPTIONS']).join(', '));response.headers.set('access-control-allow-headers',(cors.headers??['content-type','captra-protocol','x-request-id']).join(', '));if(cors.credentials)response.headers.set('access-control-allow-credentials','true');if(cors.maxAge!==undefined)response.headers.set('access-control-max-age',String(cors.maxAge))}return response}
function toRemoteResult(result:CapabilityResult):RemoteCapabilityResult{return {run:toPublicRun(result.run),capability:{name:result.capability.name,mode:result.capability.mode,description:result.capability.description,view:result.capability.view.name,state:result.capability.state},value:result.value,trace:result.trace.map(toPublicEvent)}}
function toPublicRun(run:RunRecord):RunRecord{return run.error?{...run,error:'Execution failed'}:run}
function toPublicEvent(event:CaptraEvent):CaptraEvent{return event.type==='run.failed'||event.type==='tool.failed'?{...event,detail:event.type==='run.failed'?'Execution failed':'Tool call failed',data:undefined}:event}
function streamRun(runtime:Runtime,request:Parameters<Runtime['execute']>[0],requestId:string,httpRequest:Request,onError?:CaptraHandlerOptions['onError']){
  const encoder=new TextEncoder()
  const body=new ReadableStream({start(controller){
    const send=(event:string,data:unknown)=>controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
    runtime.execute({...request,onEvent:event=>send('trace',toPublicEvent(event))}).then(result=>{send('result',toRemoteResult(result));controller.close()},async error=>{const failure=classifyError(error);await reportError(onError,{requestId,request:httpRequest,error,status:failure.status,code:failure.code});send('error',{message:failure.message,code:failure.code,requestId});controller.close()})
  }})
  return new Response(body,{headers:{'content-type':'text/event-stream','cache-control':'no-cache'}})
}
