import type { Runtime } from './core'

export type WorkItem={id:string;runId:string;attempts:number;maxAttempts:number;availableAt:number;leaseUntil?:number;leasedBy?:string}
export interface WorkQueue{
  enqueue(input:{runId:string;maxAttempts?:number;availableAt?:number}):Promise<WorkItem>
  claim(workerId:string,leaseMs:number):Promise<WorkItem|undefined>
  ack(id:string,workerId:string):Promise<boolean>
  release(id:string,workerId:string,delayMs:number):Promise<boolean>
  fail(id:string,workerId:string,error:string):Promise<boolean>
  heartbeat(id:string,workerId:string,leaseMs:number):Promise<boolean>
}

export class InMemoryWorkQueue implements WorkQueue{
  readonly #items=new Map<string,WorkItem&{status:'queued'|'leased'|'dead';error?:string}>()
  async enqueue(input:{runId:string;maxAttempts?:number;availableAt?:number}){const item={id:crypto.randomUUID(),runId:input.runId,attempts:0,maxAttempts:input.maxAttempts??3,availableAt:input.availableAt??Date.now(),status:'queued' as const};this.#items.set(item.id,item);return item}
  async claim(workerId:string,leaseMs:number){const now=Date.now();const item=[...this.#items.values()].filter(item=>(item.status==='queued'||(item.status==='leased'&&(item.leaseUntil??0)<=now))&&item.availableAt<=now&&item.attempts<item.maxAttempts).sort((a,b)=>a.availableAt-b.availableAt)[0];if(!item)return;Object.assign(item,{status:'leased',leasedBy:workerId,leaseUntil:now+leaseMs,attempts:item.attempts+1});return {...item}}
  async ack(id:string,workerId:string){const item=this.#items.get(id);if(!item||item.leasedBy!==workerId)return false;return this.#items.delete(id)}
  async release(id:string,workerId:string,delayMs:number){const item=this.#items.get(id);if(!item||item.leasedBy!==workerId)return false;Object.assign(item,{status:'queued',availableAt:Date.now()+delayMs,leasedBy:undefined,leaseUntil:undefined});return true}
  async fail(id:string,workerId:string,error:string){const item=this.#items.get(id);if(!item||item.leasedBy!==workerId)return false;Object.assign(item,{status:'dead',error,leasedBy:undefined,leaseUntil:undefined});return true}
  async heartbeat(id:string,workerId:string,leaseMs:number){const item=this.#items.get(id);if(!item||item.status!=='leased'||item.leasedBy!==workerId)return false;item.leaseUntil=Date.now()+leaseMs;return true}
}

export type WorkerOptions={runtime:Runtime;queue:WorkQueue;workerId?:string;leaseMs?:number;retryDelay?:(attempt:number)=>number}
export function createWorker(options:WorkerOptions){
  const workerId=options.workerId??crypto.randomUUID(),leaseMs=options.leaseMs??30_000,retryDelay=options.retryDelay??(attempt=>Math.min(30_000,1000*2**(attempt-1)))
  async function runOnce(){const item=await options.queue.claim(workerId,leaseMs);if(!item)return {worked:false as const};const heartbeat=setInterval(()=>{void options.queue.heartbeat(item.id,workerId,leaseMs).catch(()=>{})},Math.max(1000,Math.floor(leaseMs/3)));try{const result=await options.runtime.resume(item.runId);await options.queue.ack(item.id,workerId);return {worked:true as const,item,result}}catch(error){const message=error instanceof Error?error.message:'Worker execution failed';if(item.attempts>=item.maxAttempts)await options.queue.fail(item.id,workerId,message);else await options.queue.release(item.id,workerId,retryDelay(item.attempts));return {worked:true as const,item,error:message}}finally{clearInterval(heartbeat)}}
  return {workerId,runOnce,heartbeat:(item:WorkItem)=>options.queue.heartbeat(item.id,workerId,leaseMs)}
}
