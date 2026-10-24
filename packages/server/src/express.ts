import type { IncomingMessage,ServerResponse } from 'node:http'
import { createNodeHandler,type NodeAdapterOptions } from './node.js'

export type ExpressRequest=IncomingMessage&{originalUrl?:string}
export type ExpressResponse=ServerResponse
export type ExpressMiddleware=(request:ExpressRequest,response:ExpressResponse,next?:(error?:unknown)=>void)=>void|Promise<void>

export function createExpressMiddleware(handler:(request:Request)=>Response|Promise<Response>,options:Omit<NodeAdapterOptions,'url'>={}):ExpressMiddleware{
  const node=createNodeHandler(handler,{...options,url:request=>(request as ExpressRequest).originalUrl??request.url??'/'})
  return (request,response)=>node(request,response)
}
