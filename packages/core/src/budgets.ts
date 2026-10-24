import type { ExecutionIdentity } from './core.js'

export type BudgetQuota={tokens?:number;costUsd?:number;windowMs:number}
export type BudgetLimits={user?:BudgetQuota;tenant?:BudgetQuota}
export type BudgetAmount={tokens:number;costUsd:number}
export type BudgetReservation={id:string;amount:BudgetAmount}
export type BudgetReserveRequest={runId:string;identity:ExecutionIdentity;amount:BudgetAmount;limits:BudgetLimits;now?:number}

export class BudgetExceededError extends Error{
  readonly code='budget_exceeded'
  constructor(readonly scope:'run'|'user'|'tenant',readonly resource:'tokens'|'costUsd',readonly limit:number,readonly used:number,readonly requested:number,readonly retryAt?:number){super(`${scope} ${resource} budget exceeded (${limit})`);this.name='BudgetExceededError'}
}

export interface BudgetAdapter{
  reserve(request:BudgetReserveRequest):Promise<BudgetReservation>
  commit(reservationId:string,actual:BudgetAmount):Promise<void>
  release(reservationId:string):Promise<void>
}

type Bucket={committed:BudgetAmount;reserved:BudgetAmount;resetAt:number}
type StoredReservation={amount:BudgetAmount;keys:string[]}

export class InMemoryBudgetAdapter implements BudgetAdapter{
  readonly #buckets=new Map<string,Bucket>()
  readonly #reservations=new Map<string,StoredReservation>()
  async reserve(request:BudgetReserveRequest){
    const now=request.now??Date.now(),entries=this.#entries(request,now)
    for(const {scope,quota,bucket} of entries){
      this.#assert(scope,'tokens',quota.tokens,bucket.committed.tokens+bucket.reserved.tokens,request.amount.tokens,bucket.resetAt)
      this.#assert(scope,'costUsd',quota.costUsd,bucket.committed.costUsd+bucket.reserved.costUsd,request.amount.costUsd,bucket.resetAt)
    }
    for(const {key,bucket} of entries){bucket.reserved.tokens+=request.amount.tokens;bucket.reserved.costUsd+=request.amount.costUsd;this.#buckets.set(key,bucket)}
    const reservation={id:crypto.randomUUID(),amount:{...request.amount}};this.#reservations.set(reservation.id,{amount:{...request.amount},keys:entries.map(entry=>entry.key)});return reservation
  }
  async commit(id:string,actual:BudgetAmount){const reservation=this.#take(id);for(const key of reservation.keys){const bucket=this.#buckets.get(key);if(!bucket)continue;bucket.reserved.tokens=Math.max(0,bucket.reserved.tokens-reservation.amount.tokens);bucket.reserved.costUsd=Math.max(0,bucket.reserved.costUsd-reservation.amount.costUsd);bucket.committed.tokens+=actual.tokens;bucket.committed.costUsd+=actual.costUsd}}
  async release(id:string){const reservation=this.#take(id);for(const key of reservation.keys){const bucket=this.#buckets.get(key);if(!bucket)continue;bucket.reserved.tokens=Math.max(0,bucket.reserved.tokens-reservation.amount.tokens);bucket.reserved.costUsd=Math.max(0,bucket.reserved.costUsd-reservation.amount.costUsd)}}
  #entries(request:BudgetReserveRequest,now:number){return (['user','tenant'] as const).flatMap(scope=>{const quota=request.limits[scope];if(!quota)return[];const owner=scope==='user'?`${request.identity.tenantId}:${request.identity.userId}`:request.identity.tenantId,key=`${scope}:${owner}:${Math.floor(now/quota.windowMs)}`,resetAt=(Math.floor(now/quota.windowMs)+1)*quota.windowMs,existing=this.#buckets.get(key),bucket=existing&&existing.resetAt>now?existing:{committed:{tokens:0,costUsd:0},reserved:{tokens:0,costUsd:0},resetAt};return [{scope,quota,key,bucket}]})}
  #assert(scope:'user'|'tenant',resource:'tokens'|'costUsd',limit:number|undefined,used:number,requested:number,retryAt:number){if(limit!==undefined&&used+requested>limit)throw new BudgetExceededError(scope,resource,limit,used,requested,retryAt)}
  #take(id:string){const reservation=this.#reservations.get(id);if(!reservation)throw new Error(`Unknown budget reservation: ${id}`);this.#reservations.delete(id);return reservation}
}

export function estimateModelTokens(messages:readonly {content:string}[]){return Math.max(1,Math.ceil(messages.reduce((total,message)=>total+message.content.length,0)/4))}
