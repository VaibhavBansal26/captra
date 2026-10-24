import { compileManifest, type CapabilityResult, type RemoteCapabilityResult, type Runtime, type WorkQueue } from '@captra/core'

export type AuthResolver=(request:Request)=>Promise<{tenantId:string;userId:string;projectId:string;sessionId?:string}>
export function createCaptraHandler(runtime:Runtime,options:{auth:AuthResolver;queue?:WorkQueue}){
  return async(request:Request):Promise<Response>=>{
    const url=new URL(request.url),path=url.pathname.replace(/\/$/,'')
    try{
      if(request.method==='GET'&&path.endsWith('/manifest'))return json(compileManifest(runtime.app))
      const identity=await options.auth(request)
      if(request.method==='POST'&&path.endsWith('/runs/queue')){if(!options.queue)return json({error:'Background queue is not configured'},501);const body=await request.json() as {capability:string;input:unknown;idempotencyKey?:string;maxAttempts?:number;availableAt?:number};const {maxAttempts,availableAt,...run}=body;return json(await runtime.enqueue({...run,identity},options.queue,{maxAttempts,availableAt}),202)}
      if(request.method==='POST'&&path.endsWith('/runs/stream')){const body=await request.json() as {capability:string;input:unknown;idempotencyKey?:string};return streamRun(runtime,{...body,identity})}
      if(request.method==='POST'&&path.endsWith('/runs')){const body=await request.json() as {capability:string;input:unknown;idempotencyKey?:string};return json(toRemoteResult(await runtime.execute({...body,identity})),202)}
      const approval=path.match(/\/runs\/([^/]+)\/(approve|reject)$/)
      if(request.method==='POST'&&approval){await assertOwner(runtime,approval[1],identity);return json(toRemoteResult(await runtime.approve(approval[1],approval[2]==='approve'?'approved':'rejected')))}
      const cancellation=path.match(/\/runs\/([^/]+)\/cancel$/)
      if(request.method==='POST'&&cancellation){await assertOwner(runtime,cancellation[1],identity);return json(await runtime.cancel(cancellation[1]))}
      const events=path.match(/\/runs\/([^/]+)\/events$/)
      if(request.method==='GET'&&events){await assertOwner(runtime,events[1],identity);return json(await runtime.runs.events(events[1],Number(url.searchParams.get('after')??0)))}
      const replay=path.match(/\/runs\/([^/]+)\/replay$/)
      if(request.method==='GET'&&replay){await assertOwner(runtime,replay[1],identity);return json(await runtime.replay(replay[1]))}
      const run=path.match(/\/runs\/([^/]+)$/)
      if(request.method==='GET'&&run){await assertOwner(runtime,run[1],identity);return json(await runtime.runs.get(run[1]))}
      return json({error:'Not found'},404)
    }catch(error){return json({error:error instanceof Error?error.message:'Unknown error'},400)}
  }
}
async function assertOwner(runtime:Runtime,runId:string,identity:{tenantId:string;userId:string}){const run=await runtime.runs.get(runId);if(!run||run.identity.tenantId!==identity.tenantId||run.identity.userId!==identity.userId)throw new Error('Run not found')}
function json(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','captra-protocol':'1.0'}})}
function toRemoteResult(result:CapabilityResult):RemoteCapabilityResult{return {run:result.run,capability:{name:result.capability.name,mode:result.capability.mode,description:result.capability.description,view:result.capability.view.name},value:result.value,trace:result.trace}}
function streamRun(runtime:Runtime,request:Parameters<Runtime['execute']>[0]){
  const encoder=new TextEncoder()
  const body=new ReadableStream({start(controller){
    const send=(event:string,data:unknown)=>controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
    runtime.execute({...request,onEvent:event=>send('trace',event)}).then(result=>{send('result',toRemoteResult(result));controller.close()},error=>{send('error',{message:error instanceof Error?error.message:'Unknown error'});controller.close()})
  }})
  return new Response(body,{headers:{'content-type':'text/event-stream','cache-control':'no-cache','captra-protocol':'1.0'}})
}
