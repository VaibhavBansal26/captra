import { CAPTRA_PROTOCOL_VERSION, type CaptraEvent, type RunRecord } from './protocol.js'
export type CreateRun=Omit<RunRecord,'id'|'status'|'createdAt'|'updatedAt'>
export interface RunStore { create(input:CreateRun):Promise<RunRecord>; get(id:string):Promise<RunRecord|undefined>; update(id:string,patch:Partial<RunRecord>):Promise<void>; appendEvent(id:string,event:Omit<CaptraEvent,'id'|'protocol'|'runId'|'sequence'|'at'>):Promise<CaptraEvent>; events(id:string,after?:number):Promise<CaptraEvent[]>; findByIdempotencyKey(tenantId:string,key:string):Promise<RunRecord|undefined> }
export class InMemoryRunStore implements RunStore {
  readonly #runs=new Map<string,RunRecord>(); readonly #events=new Map<string,CaptraEvent[]>()
  async create(input:CreateRun){ const now=Date.now(); const run:RunRecord={...input,id:crypto.randomUUID(),status:'created',createdAt:now,updatedAt:now}; this.#runs.set(run.id,run); this.#events.set(run.id,[]); return run }
  async get(id:string){ return this.#runs.get(id) }
  async update(id:string,patch:Partial<RunRecord>){ const run=this.#runs.get(id); if(!run)throw new Error(`Unknown run: ${id}`); this.#runs.set(id,{...run,...patch,id,updatedAt:Date.now()}) }
  async appendEvent(runId:string,input:Omit<CaptraEvent,'id'|'protocol'|'runId'|'sequence'|'at'>){ const list=this.#events.get(runId); if(!list)throw new Error(`Unknown run: ${runId}`); const event:CaptraEvent={...input,id:crypto.randomUUID(),protocol:CAPTRA_PROTOCOL_VERSION,runId,sequence:list.length+1,at:Date.now()}; list.push(event); return event }
  async events(id:string,after=0){ return (this.#events.get(id)??[]).filter(event=>event.sequence>after) }
  async findByIdempotencyKey(tenantId:string,key:string){ return [...this.#runs.values()].find(run=>run.identity.tenantId===tenantId&&run.idempotencyKey===key) }
}
