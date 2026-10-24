export type CheckpointRecord={id:string;runId:string;key:string;sequence:number;state:unknown;createdAt:number}
export interface CheckpointStore{save(runId:string,key:string,state:unknown):Promise<CheckpointRecord>;load(runId:string,key:string):Promise<CheckpointRecord|undefined>;list(runId:string):Promise<CheckpointRecord[]>}
export class InMemoryCheckpointStore implements CheckpointStore{
  readonly #records=new Map<string,CheckpointRecord[]>()
  async save(runId:string,key:string,state:unknown){const list=this.#records.get(runId)??[],record={id:crypto.randomUUID(),runId,key,sequence:list.length+1,state:structuredClone(state),createdAt:Date.now()};list.push(record);this.#records.set(runId,list);return record}
  async load(runId:string,key:string){return [...(this.#records.get(runId)??[])].reverse().find(record=>record.key===key)}
  async list(runId:string){return [...(this.#records.get(runId)??[])]}
}
export type RunCheckpoints={save(key:string,state:unknown):Promise<CheckpointRecord>;load(key:string):Promise<CheckpointRecord|undefined>;list():Promise<CheckpointRecord[]>}
