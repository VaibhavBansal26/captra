import { compileManifest, type Runtime } from '@captra/core'

export type AuthResolver=(request:Request)=>Promise<{tenantId:string;userId:string;projectId:string;sessionId?:string}>
export function createCaptraHandler(runtime:Runtime,options:{auth:AuthResolver}){
  return async(request:Request):Promise<Response>=>{
    const url=new URL(request.url),path=url.pathname.replace(/\/$/,'')
    try{
      if(request.method==='GET'&&path.endsWith('/manifest'))return json(compileManifest(runtime.app))
      const identity=await options.auth(request)
      if(request.method==='POST'&&path.endsWith('/runs')){const body=await request.json() as {capability:string;input:unknown;idempotencyKey?:string};return json(await runtime.execute({...body,identity}),202)}
      const approval=path.match(/\/runs\/([^/]+)\/(approve|reject)$/)
      if(request.method==='POST'&&approval)return json(await runtime.approve(approval[1],approval[2]==='approve'?'approved':'rejected'))
      const cancellation=path.match(/\/runs\/([^/]+)\/cancel$/)
      if(request.method==='POST'&&cancellation)return json(await runtime.cancel(cancellation[1]))
      const events=path.match(/\/runs\/([^/]+)\/events$/)
      if(request.method==='GET'&&events)return json(await runtime.runs.events(events[1],Number(url.searchParams.get('after')??0)))
      const run=path.match(/\/runs\/([^/]+)$/)
      if(request.method==='GET'&&run)return json(await runtime.runs.get(run[1]))
      return json({error:'Not found'},404)
    }catch(error){return json({error:error instanceof Error?error.message:'Unknown error'},400)}
  }
}
function json(value:unknown,status=200){return new Response(JSON.stringify(value),{status,headers:{'content-type':'application/json','captra-protocol':'1.0'}})}
