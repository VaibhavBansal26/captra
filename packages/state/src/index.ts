export type StateKey=string|readonly unknown[]
export type StateStatus='idle'|'loading'|'success'|'error'
export type StateSnapshot<T=unknown>={readonly key:StateKey;readonly data:T|undefined;readonly error:unknown;readonly status:StateStatus;readonly stale:boolean;readonly updatedAt:number;readonly version:number}
export type SerializedState={version:1;entries:Array<{key:StateKey;data:unknown;updatedAt:number;stale?:boolean}>}
export type StatePersistence={load:()=>SerializedState|null|Promise<SerializedState|null>;save:(state:SerializedState)=>void|Promise<void>}
export type StateMatcher=StateKey|((snapshot:StateSnapshot)=>boolean)
export type StateEffects={readonly reads?:readonly StateKey[];readonly writes?:readonly StateKey[];readonly invalidates?:readonly StateKey[]}
export type OptimisticUpdate<T>={readonly snapshot:StateSnapshot<T>;commit:()=>void;rollback:()=>void}

type Entry={key:StateKey;data:unknown;error:unknown;status:StateStatus;stale:boolean;updatedAt:number;version:number}
const idle=(key:StateKey):Entry=>({key,data:undefined,error:undefined,status:'idle',stale:true,updatedAt:0,version:0})
export function hashStateKey(key:StateKey):string{return typeof key==='string'?`s:${key}`:`a:${stable(key)}`}
function stable(value:unknown):string{if(value===undefined)return 'undefined';if(typeof value==='number'&&!Number.isFinite(value))return JSON.stringify(String(value));if(!value||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${stable(item)}`).join(',')}}`}
function matches(candidate:StateKey,matcher:StateMatcher,snapshot:StateSnapshot){if(typeof matcher==='function')return matcher(snapshot);if(typeof matcher==='string')return typeof candidate==='string'?candidate===matcher:Array.isArray(candidate)&&candidate[0]===matcher;const left=Array.isArray(candidate)?candidate:[candidate],right=Array.isArray(matcher)?matcher:[matcher];return right.length<=left.length&&right.every((value,index)=>stable(value)===stable(left[index]))}

export class CaptraState{
  private entries=new Map<string,Entry>()
  private listeners=new Map<string,Set<()=>void>>()
  private inflight=new Map<string,Promise<unknown>>()
  private persistence?:StatePersistence
  private persistQueued=false
  constructor(options:{persistence?:StatePersistence;initial?:SerializedState}={}){this.persistence=options.persistence;if(options.initial)this.hydrate(options.initial)}
  snapshot<T=unknown>(key:StateKey):StateSnapshot<T>{const hash=hashStateKey(key),existing=this.entries.get(hash);if(existing)return existing as StateSnapshot<T>;const entry=idle(key);this.entries.set(hash,entry);return entry as StateSnapshot<T>}
  get<T=unknown>(key:StateKey):T|undefined{return this.snapshot<T>(key).data}
  subscribe(key:StateKey,listener:()=>void){const hash=hashStateKey(key),set=this.listeners.get(hash)??new Set();set.add(listener);this.listeners.set(hash,set);return()=>{set.delete(listener);if(!set.size)this.listeners.delete(hash)}}
  set<T>(key:StateKey,data:T):StateSnapshot<T>{const previous=this.snapshot(key),next:Entry={key,data,error:undefined,status:'success',stale:false,updatedAt:Date.now(),version:previous.version+1};this.entries.set(hashStateKey(key),next);this.emit(key);this.queuePersist();return next as StateSnapshot<T>}
  async fetch<T>(key:StateKey,loader:()=>Promise<T>,options:{staleTime?:number;force?:boolean}={}):Promise<T>{const hash=hashStateKey(key),current=this.snapshot<T>(key),fresh=current.status==='success'&&!current.stale&&Date.now()-current.updatedAt<=(options.staleTime??0);if(!options.force&&fresh)return current.data as T;const active=this.inflight.get(hash);if(active)return active as Promise<T>;this.entries.set(hash,{...current,status:'loading',error:undefined});this.emit(key);const request=loader().then(data=>{this.set(key,data);return data},error=>{const latest=this.snapshot(key);this.entries.set(hash,{...latest,error,status:'error',stale:true,version:latest.version+1});this.emit(key);throw error}).finally(()=>this.inflight.delete(hash));this.inflight.set(hash,request);return request}
  invalidate(matcher:StateMatcher){let count=0;for(const [hash,entry] of this.entries){if(matches(entry.key,matcher,entry)){this.entries.set(hash,{...entry,stale:true,version:entry.version+1});this.emit(entry.key);count++}}if(count)this.queuePersist();return count}
  apply(effects?:StateEffects){if(!effects)return 0;return [...(effects.writes??[]),...(effects.invalidates??[])].reduce((count,key)=>count+this.invalidate(key),0)}
  optimistic<T>(key:StateKey,update:T|((current:T|undefined)=>T)):OptimisticUpdate<T>{const before=this.snapshot<T>(key),next=typeof update==='function'?(update as (current:T|undefined)=>T)(before.data):update,snapshot=this.set(key,next);let settled=false;return{snapshot,commit:()=>{settled=true},rollback:()=>{if(settled)return;settled=true;const current=this.snapshot(key);if(current.version!==snapshot.version)return;this.entries.set(hashStateKey(key),{...before,version:current.version+1});this.emit(key);this.queuePersist()}}}
  remove(matcher:StateMatcher){let count=0;for(const [hash,entry] of this.entries){if(matches(entry.key,matcher,entry)){this.entries.delete(hash);this.emit(entry.key);count++}}if(count)this.queuePersist();return count}
  clear(){const keys=[...this.entries.values()].map(entry=>entry.key);this.entries.clear();keys.forEach(key=>this.emit(key));this.queuePersist()}
  dehydrate():SerializedState{return{version:1,entries:[...this.entries.values()].filter(entry=>entry.status==='success').map(({key,data,updatedAt,stale})=>({key,data,updatedAt,stale}))}}
  hydrate(state:SerializedState){if(state.version!==1)throw new Error(`Unsupported Captra state version: ${String((state as {version?:unknown}).version)}`);for(const item of state.entries){const previous=this.snapshot(item.key);this.entries.set(hashStateKey(item.key),{key:item.key,data:item.data,error:undefined,status:'success',stale:item.stale??false,updatedAt:item.updatedAt,version:previous.version+1});this.emit(item.key)}}
  async restore(){const state=await this.persistence?.load();if(state)this.hydrate(state);return this}
  private emit(key:StateKey){for(const listener of this.listeners.get(hashStateKey(key))??[])listener()}
  private queuePersist(){if(!this.persistence||this.persistQueued)return;this.persistQueued=true;queueMicrotask(()=>{this.persistQueued=false;void this.persistence!.save(this.dehydrate())})}
}

export function createState(options:ConstructorParameters<typeof CaptraState>[0]={}){return new CaptraState(options)}
export function createMemoryPersistence(initial:SerializedState|null=null):StatePersistence&{read:()=>SerializedState|null}{let value=initial;return{load:()=>value,save:state=>{value=state},read:()=>value}}
export function createLocalStoragePersistence(key='captra:state',storage:Pick<Storage,'getItem'|'setItem'>=localStorage):StatePersistence{return{load:()=>{const value=storage.getItem(key);return value?JSON.parse(value) as SerializedState:null},save:state=>storage.setItem(key,JSON.stringify(state))}}

export * from './shared.js'
