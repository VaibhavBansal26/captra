import { z } from 'zod'
import type { ModelAdapter } from './models'

export type MemoryScope = 'organization' | 'user' | 'project' | 'session' | 'task'
export type MemoryIdentity = { tenantId?:string; userId:string; projectId:string; sessionId?:string; taskId?:string; runId?:string }
export type MemoryRecord = { id:string; scope:MemoryScope; ownerId:string; tenantId?:string; type:'fact'|'preference'|'decision'|'working-state'; content:string; confidence:number; createdAt:number; expiresAt?:number }
export type MemoryRecallOptions={query?:string;limit?:number;minConfidence?:number}
export interface MemoryAdapter {
  remember(record:Omit<MemoryRecord,'id'|'createdAt'>): Promise<MemoryRecord>|MemoryRecord
  recall(scopes:readonly MemoryScope[], identity:MemoryIdentity, options?:MemoryRecallOptions): Promise<MemoryRecord[]>|MemoryRecord[]
  forget?(id:string, identity:MemoryIdentity):Promise<boolean>|boolean
  list?():readonly MemoryRecord[]
}
export class MemoryStore implements MemoryAdapter {
  readonly #records:MemoryRecord[]
  constructor(seed:MemoryRecord[]=[]){ this.#records=[...seed] }
  remember(record:Omit<MemoryRecord,'id'|'createdAt'>):MemoryRecord { const saved={...record,id:crypto.randomUUID(),createdAt:Date.now()}; this.#records.push(saved); return saved }
  recall(scopes:readonly MemoryScope[], identity:MemoryIdentity,options:MemoryRecallOptions={}):MemoryRecord[]{ const allowed=new Set(scopes),terms=options.query?.toLowerCase().split(/\s+/).filter(Boolean)??[];return this.#records.filter(record=>{ if(record.expiresAt&&record.expiresAt<=Date.now())return false;if(record.confidence<(options.minConfidence??0)||!allowed.has(record.scope))return false; if(record.tenantId&&record.tenantId!==identity.tenantId)return false; if(record.scope==='user'&&record.ownerId!==identity.userId)return false; if(record.scope==='project'&&record.ownerId!==identity.projectId)return false; if(record.scope==='session'&&record.ownerId!==identity.sessionId)return false; if(record.scope==='task'&&record.ownerId!==(identity.taskId??identity.runId))return false;return !terms.length||terms.some(term=>record.content.toLowerCase().includes(term))}).sort((a,b)=>b.confidence-a.confidence||b.createdAt-a.createdAt).slice(0,options.limit??Number.MAX_SAFE_INTEGER) }
  forget(id:string, identity:MemoryIdentity):boolean { const index=this.#records.findIndex(record=>record.id===id&&(!record.tenantId||record.tenantId===identity.tenantId)); if(index<0)return false; this.#records.splice(index,1); return true }
  list():readonly MemoryRecord[]{ return this.#records }
}

export interface EmbeddingAdapter{embed(texts:readonly string[]):Promise<readonly (readonly number[])[]>}
export class AdaptiveMemoryStore implements MemoryAdapter{
  readonly #vectors=new Map<string,readonly number[]>()
  constructor(readonly base:MemoryAdapter,readonly embeddings:EmbeddingAdapter,readonly defaults:{limit?:number;minSimilarity?:number;deduplicateSimilarity?:number}={}){}
  async remember(record:Omit<MemoryRecord,'id'|'createdAt'>){const [vector]=await this.embeddings.embed([record.content]);const identity={tenantId:record.tenantId,userId:record.ownerId,projectId:record.ownerId,sessionId:record.ownerId,taskId:record.ownerId};const recalled=await this.base.recall([record.scope],identity,{limit:100});const candidates=recalled.filter(item=>item.type===record.type&&(!item.expiresAt||item.expiresAt>Date.now()));const missing=candidates.filter(item=>!this.#vectors.has(item.id));if(missing.length){const vectors=await this.embeddings.embed(missing.map(item=>item.content));missing.forEach((item,index)=>this.#vectors.set(item.id,vectors[index]))}const duplicate=candidates.find(item=>cosine(vector,this.#vectors.get(item.id)??[])>=(this.defaults.deduplicateSimilarity??.98));if(duplicate)return duplicate;const saved=await this.base.remember(record);this.#vectors.set(saved.id,vector);return saved}
  async recall(scopes:readonly MemoryScope[],identity:MemoryIdentity,options:MemoryRecallOptions={}){let records=await this.base.recall(scopes,identity,{minConfidence:options.minConfidence});records=records.filter(record=>!record.expiresAt||record.expiresAt>Date.now());if(!options.query)return records.slice(0,options.limit??this.defaults.limit??20);const missing=records.filter(record=>!this.#vectors.has(record.id));if(missing.length){const vectors=await this.embeddings.embed(missing.map(record=>record.content));missing.forEach((record,index)=>this.#vectors.set(record.id,vectors[index]))}const [query]=await this.embeddings.embed([options.query]);return records.map(record=>({record,score:cosine(query,this.#vectors.get(record.id)??[])})).filter(item=>item.score>=(this.defaults.minSimilarity??0)).sort((a,b)=>b.score-a.score||b.record.confidence-a.record.confidence).slice(0,options.limit??this.defaults.limit??20).map(item=>item.record)}
  async forget(id:string,identity:MemoryIdentity){this.#vectors.delete(id);return this.base.forget?this.base.forget(id,identity):false}
  list(){return this.base.list?.()??[]}
  async ingest(text:string,defaults:{tenantId?:string;scope:MemoryScope;ownerId:string;expiresAt?:number},extractor:MemoryExtractor){const candidates=await extractor.extract(text);return Promise.all(candidates.map(candidate=>this.remember({...defaults,...candidate})))}
}
function cosine(a:readonly number[],b:readonly number[]){if(!a.length||a.length!==b.length)return -1;let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i]}return aa&&bb?dot/(Math.sqrt(aa)*Math.sqrt(bb)):-1}
export type MemoryCandidate=Pick<MemoryRecord,'type'|'content'|'confidence'>
export interface MemoryExtractor{extract(text:string):Promise<MemoryCandidate[]>}
const candidatesSchema=z.array(z.object({type:z.enum(['fact','preference','decision','working-state']),content:z.string().min(1),confidence:z.number().min(0).max(1)}))
export function createMemoryExtractor(model:ModelAdapter):MemoryExtractor{return {async extract(text){const response=await model.generate({messages:[{role:'system',content:'Extract only durable, useful memories. Return a JSON array with type (fact, preference, decision, or working-state), content, and confidence from 0 to 1. Return [] when nothing should be remembered.'},{role:'user',content:text}]});let value:unknown;try{value=JSON.parse(response.text)}catch{throw new Error('Memory extractor returned invalid JSON')}return candidatesSchema.parse(value)}}}
