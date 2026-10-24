import { hashStateKey,type StateKey } from './index.js'

export type SharedStateSnapshot<T>={readonly key:StateKey;readonly value:T|undefined;readonly version:number;readonly updatedAt:number}
export type StateLease={readonly key:StateKey;readonly owner:string;readonly token:number;readonly expiresAt:number}
export type SharedStateEvent={readonly id:string;readonly key:StateKey;readonly type:'state.committed'|'state.conflict'|'lease.acquired'|'lease.renewed'|'lease.released';readonly actor:string;readonly at:number;readonly version:number;readonly token?:number}
export type StateSchema<T>={parse:(value:unknown)=>T}
export type CommitOptions={expectedVersion:number;actor:string;lease?:StateLease}
export type AcquireLeaseOptions={owner:string;ttlMs?:number}

export class StateConflictError extends Error{constructor(readonly key:StateKey,readonly expectedVersion:number,readonly actualVersion:number){super(`State conflict for ${hashStateKey(key)}: expected version ${expectedVersion}, received ${actualVersion}`);this.name='StateConflictError'}}
export class StateLeaseError extends Error{constructor(message:string){super(message);this.name='StateLeaseError'}}

export interface SharedStateAdapter{
  read<T>(key:StateKey):Promise<SharedStateSnapshot<T>>
  commit<T>(key:StateKey,value:T,options:CommitOptions):Promise<SharedStateSnapshot<T>>
  acquire(key:StateKey,options:AcquireLeaseOptions):Promise<StateLease>
  renew(lease:StateLease,ttlMs?:number):Promise<StateLease>
  release(lease:StateLease):Promise<void>
  history(key:StateKey):Promise<readonly SharedStateEvent[]>
}

type Stored={key:StateKey;value:unknown;version:number;updatedAt:number}
export class InMemorySharedStateAdapter implements SharedStateAdapter{
  private values=new Map<string,Stored>()
  private leases=new Map<string,StateLease>()
  private fences=new Map<string,number>()
  private events=new Map<string,SharedStateEvent[]>()
  async read<T>(key:StateKey):Promise<SharedStateSnapshot<T>>{const stored=this.values.get(hashStateKey(key));return stored?stored as SharedStateSnapshot<T>:{key,value:undefined,version:0,updatedAt:0}}
  async commit<T>(key:StateKey,value:T,options:CommitOptions):Promise<SharedStateSnapshot<T>>{
    const hash=hashStateKey(key),current=await this.read<T>(key)
    if(current.version!==options.expectedVersion){this.record(key,'state.conflict',options.actor,current.version,options.lease?.token);throw new StateConflictError(key,options.expectedVersion,current.version)}
    if(options.lease)this.assertLease(hash,options.lease)
    const next:Stored={key,value,version:current.version+1,updatedAt:Date.now()};this.values.set(hash,next);this.record(key,'state.committed',options.actor,next.version,options.lease?.token);return next as SharedStateSnapshot<T>
  }
  async acquire(key:StateKey,{owner,ttlMs=10_000}:AcquireLeaseOptions):Promise<StateLease>{if(ttlMs<=0)throw new StateLeaseError('Lease TTL must be positive');const hash=hashStateKey(key),active=this.leases.get(hash),now=Date.now();if(active&&active.expiresAt>now)throw new StateLeaseError(`State is leased by ${active.owner}`);const token=(this.fences.get(hash)??0)+1,lease={key,owner,token,expiresAt:now+ttlMs};this.fences.set(hash,token);this.leases.set(hash,lease);this.record(key,'lease.acquired',owner,(await this.read(key)).version,token);return lease}
  async renew(lease:StateLease,ttlMs=10_000):Promise<StateLease>{if(ttlMs<=0)throw new StateLeaseError('Lease TTL must be positive');const hash=hashStateKey(lease.key);this.assertLease(hash,lease);const renewed={...lease,expiresAt:Date.now()+ttlMs};this.leases.set(hash,renewed);this.record(lease.key,'lease.renewed',lease.owner,(await this.read(lease.key)).version,lease.token);return renewed}
  async release(lease:StateLease){const hash=hashStateKey(lease.key);this.assertLease(hash,lease);this.leases.delete(hash);this.record(lease.key,'lease.released',lease.owner,(await this.read(lease.key)).version,lease.token)}
  async history(key:StateKey){return Object.freeze([...(this.events.get(hashStateKey(key))??[])])}
  private assertLease(hash:string,lease:StateLease){const active=this.leases.get(hash);if(!active||active.token!==lease.token||active.owner!==lease.owner)throw new StateLeaseError('Lease is missing or has been superseded');if(active.expiresAt<=Date.now()){this.leases.delete(hash);throw new StateLeaseError('Lease has expired')}}
  private record(key:StateKey,type:SharedStateEvent['type'],actor:string,version:number,token?:number){const hash=hashStateKey(key),events=this.events.get(hash)??[];events.push({id:crypto.randomUUID(),key,type,actor,at:Date.now(),version,...(token===undefined?{}:{token})});this.events.set(hash,events)}
}

export type SharedState<T>={
  readonly key:StateKey
  read:()=>Promise<SharedStateSnapshot<T>>
  commit:(value:T,options:CommitOptions)=>Promise<SharedStateSnapshot<T>>
  acquire:(options:AcquireLeaseOptions)=>Promise<StateLease>
  renew:(lease:StateLease,ttlMs?:number)=>Promise<StateLease>
  release:(lease:StateLease)=>Promise<void>
  history:()=>Promise<readonly SharedStateEvent[]>
}
export function sharedState<T>(options:{key:StateKey;adapter:SharedStateAdapter;schema?:StateSchema<T>}):SharedState<T>{const parse=(value:T)=>options.schema?options.schema.parse(value):value;return{key:options.key,read:()=>options.adapter.read<T>(options.key),commit:(value,commit)=>options.adapter.commit(options.key,parse(value),commit),acquire:lease=>options.adapter.acquire(options.key,lease),renew:(lease,ttlMs)=>options.adapter.renew(lease,ttlMs),release:lease=>options.adapter.release(lease),history:()=>options.adapter.history(options.key)}}

export async function coordinateAgentState<T,Decision>(options:{state:SharedState<T>;actor:string;decide:(snapshot:SharedStateSnapshot<T>,attempt:number)=>Promise<{value:T;decision:Decision}>;validate?:(value:T,snapshot:SharedStateSnapshot<T>)=>void|Promise<void>;maxConflicts?:number}){
  const maxConflicts=options.maxConflicts??2
  for(let attempt=0;attempt<=maxConflicts;attempt++){
    const snapshot=await options.state.read()
    const proposed=await options.decide(snapshot,attempt)
    await options.validate?.(proposed.value,snapshot)
    try{return{snapshot:await options.state.commit(proposed.value,{expectedVersion:snapshot.version,actor:options.actor}),decision:proposed.decision,attempts:attempt+1}}
    catch(error){if(!(error instanceof StateConflictError)||attempt===maxConflicts)throw error}
  }
  throw new Error('Unreachable agent state coordination failure')
}
