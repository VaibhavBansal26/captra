import { Readable } from 'node:stream'
import type { IncomingMessage,ServerResponse } from 'node:http'

export type NodeHandler=(request:IncomingMessage,response:ServerResponse)=>void|Promise<void>
export type NodeAdapterOptions={origin?:string|((request:IncomingMessage)=>string);url?:string|((request:IncomingMessage)=>string)}

export function createNodeHandler(handler:(request:Request)=>Response|Promise<Response>,options:NodeAdapterOptions={}):NodeHandler{
  return async(incoming,outgoing)=>{
    try{
      const headers=new Headers()
      for(const [name,value] of Object.entries(incoming.headers)){if(Array.isArray(value))for(const item of value)headers.append(name,item);else if(value!==undefined)headers.set(name,value)}
      const origin=typeof options.origin==='function'?options.origin(incoming):options.origin??inferOrigin(incoming),url=typeof options.url==='function'?options.url(incoming):options.url??incoming.url??'/'
      const method=incoming.method??'GET',hasBody=method!=='GET'&&method!=='HEAD'
      const init:RequestInit&{duplex?:'half'}={method,headers,signal:abortSignal(incoming)}
      if(hasBody){init.body=Readable.toWeb(incoming) as ReadableStream<Uint8Array>;init.duplex='half'}
      const response=await handler(new Request(new URL(url,origin),init))
      outgoing.statusCode=response.status
      outgoing.statusMessage=response.statusText
      response.headers.forEach((value,name)=>outgoing.setHeader(name,value))
      if(!response.body){outgoing.end();return}
      Readable.fromWeb(response.body as import('node:stream/web').ReadableStream).pipe(outgoing)
    }catch(error){if(outgoing.headersSent){outgoing.destroy(error instanceof Error?error:undefined);return}outgoing.statusCode=500;outgoing.setHeader('content-type','application/json');outgoing.end(JSON.stringify({error:error instanceof Error?error.message:'Node adapter failed',code:'adapter_error'}))}
  }
}

function inferOrigin(request:IncomingMessage){const forwarded=first(request.headers['x-forwarded-proto']),secure='encrypted' in request.socket&&request.socket.encrypted===true,protocol=forwarded??(secure?'https':'http'),host=first(request.headers.host)??'localhost';return `${protocol}://${host}`}
function first(value:string|string[]|undefined){return Array.isArray(value)?value[0]:value?.split(',')[0]?.trim()}
function abortSignal(request:IncomingMessage){const controller=new AbortController();request.once('aborted',()=>controller.abort());return controller.signal}
