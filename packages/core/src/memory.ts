export type MemoryScope = 'organization' | 'user' | 'project' | 'session' | 'task'
export type MemoryIdentity = { tenantId?:string; userId:string; projectId:string; sessionId?:string; taskId?:string; runId?:string }
export type MemoryRecord = { id:string; scope:MemoryScope; ownerId:string; tenantId?:string; type:'fact'|'preference'|'decision'|'working-state'; content:string; confidence:number; createdAt:number }
export interface MemoryAdapter {
  remember(record:Omit<MemoryRecord,'id'|'createdAt'>): Promise<MemoryRecord>|MemoryRecord
  recall(scopes:readonly MemoryScope[], identity:MemoryIdentity): Promise<MemoryRecord[]>|MemoryRecord[]
  forget?(id:string, identity:MemoryIdentity):Promise<boolean>|boolean
  list?():readonly MemoryRecord[]
}
export class MemoryStore implements MemoryAdapter {
  readonly #records:MemoryRecord[]
  constructor(seed:MemoryRecord[]=[]){ this.#records=[...seed] }
  remember(record:Omit<MemoryRecord,'id'|'createdAt'>):MemoryRecord { const saved={...record,id:crypto.randomUUID(),createdAt:Date.now()}; this.#records.push(saved); return saved }
  recall(scopes:readonly MemoryScope[], identity:MemoryIdentity):MemoryRecord[]{ const allowed=new Set(scopes); return this.#records.filter(record=>{ if(!allowed.has(record.scope))return false; if(record.tenantId&&record.tenantId!==identity.tenantId)return false; if(record.scope==='user')return record.ownerId===identity.userId; if(record.scope==='project')return record.ownerId===identity.projectId; if(record.scope==='session')return record.ownerId===identity.sessionId; if(record.scope==='task')return record.ownerId===(identity.taskId??identity.runId); return true }) }
  forget(id:string, identity:MemoryIdentity):boolean { const index=this.#records.findIndex(record=>record.id===id&&(!record.tenantId||record.tenantId===identity.tenantId)); if(index<0)return false; this.#records.splice(index,1); return true }
  list():readonly MemoryRecord[]{ return this.#records }
}
