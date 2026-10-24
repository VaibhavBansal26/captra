export type EffectReceipt={key:string;tenantId:string;tool:string;status:'started'|'completed'|'in_doubt';output?:unknown;error?:string;createdAt:number;updatedAt:number}
export type EffectClaim={status:'claimed'}|{status:'completed';output:unknown}|{status:'in_doubt';receipt:EffectReceipt}

export class EffectInDoubtError extends Error{
  readonly code='effect_in_doubt'
  constructor(readonly receipt:EffectReceipt){super(`Effect ${receipt.tool} is in doubt for key ${receipt.key}`);this.name='EffectInDoubtError'}
}

export interface EffectStore{
  claim(tenantId:string,tool:string,key:string):Promise<EffectClaim>
  complete(tenantId:string,tool:string,key:string,output:unknown):Promise<void>
  doubt(tenantId:string,tool:string,key:string,error:string):Promise<void>
}

export class InMemoryEffectStore implements EffectStore{
  readonly #receipts=new Map<string,EffectReceipt>()
  async claim(tenantId:string,tool:string,key:string):Promise<EffectClaim>{const id=this.#id(tenantId,tool,key),existing=this.#receipts.get(id);if(existing?.status==='completed')return {status:'completed',output:structuredClone(existing.output)};if(existing)return {status:'in_doubt',receipt:structuredClone(existing)};const now=Date.now();this.#receipts.set(id,{key,tenantId,tool,status:'started',createdAt:now,updatedAt:now});return {status:'claimed'}}
  async complete(tenantId:string,tool:string,key:string,output:unknown){const id=this.#id(tenantId,tool,key),existing=this.#receipts.get(id);if(!existing)throw new Error(`Effect was not claimed: ${tool}/${key}`);this.#receipts.set(id,{...existing,status:'completed',output:structuredClone(output),error:undefined,updatedAt:Date.now()})}
  async doubt(tenantId:string,tool:string,key:string,error:string){const id=this.#id(tenantId,tool,key),existing=this.#receipts.get(id);if(!existing)throw new Error(`Effect was not claimed: ${tool}/${key}`);this.#receipts.set(id,{...existing,status:'in_doubt',error,updatedAt:Date.now()})}
  #id(tenantId:string,tool:string,key:string){return `${tenantId}\u0000${tool}\u0000${key}`}
}
