export type UsageStatus='succeeded'|'failed'|'skipped'
export type UsageGroupBy='run'|'capability'|'user'|'tenant'|'provider'|'model'
export type UsageRecord={id:string;runId:string;tenantId:string;userId:string;projectId:string;capability:string;provider:string;model?:string;attempt:number;status:UsageStatus;inputTokens:number;outputTokens:number;cachedInputTokens:number;reasoningTokens:number;tokens:number;costUsd:number;durationMs:number;createdAt:number}
export type UsageInput=Omit<UsageRecord,'id'|'tokens'|'createdAt'> & {id?:string;createdAt?:number}
export type UsageQuery={tenantId:string;userId?:string;projectId?:string;runId?:string;capability?:string;provider?:string;model?:string;from?:number;to?:number;limit?:number}
export type UsageSummary={key:string;calls:number;succeeded:number;failed:number;skipped:number;inputTokens:number;outputTokens:number;cachedInputTokens:number;reasoningTokens:number;tokens:number;costUsd:number;durationMs:number}
export interface UsageStore{record(input:UsageInput):Promise<UsageRecord>;query(query:UsageQuery):Promise<UsageRecord[]>;summarize(query:UsageQuery,groupBy:UsageGroupBy):Promise<UsageSummary[]>}

export class InMemoryUsageStore implements UsageStore{
  readonly records:UsageRecord[]=[]
  async record(input:UsageInput){if(input.id){const existing=this.records.find(record=>record.id===input.id);if(existing)return structuredClone(existing)}const record:UsageRecord={...input,id:input.id??crypto.randomUUID(),tokens:input.inputTokens+input.outputTokens,createdAt:input.createdAt??Date.now()};this.records.push(structuredClone(record));return structuredClone(record)}
  async query(query:UsageQuery){return this.records.filter(record=>matches(record,query)).slice(0,query.limit??1000).map(record=>structuredClone(record))}
  async summarize(query:UsageQuery,groupBy:UsageGroupBy){return summarizeUsage(await this.query({...query,limit:query.limit??Number.MAX_SAFE_INTEGER}),groupBy)}
}

export function summarizeUsage(records:readonly UsageRecord[],groupBy:UsageGroupBy):UsageSummary[]{
  const groups=new Map<string,UsageSummary>()
  for(const record of records){const key=groupKey(record,groupBy),summary=groups.get(key)??{key,calls:0,succeeded:0,failed:0,skipped:0,inputTokens:0,outputTokens:0,cachedInputTokens:0,reasoningTokens:0,tokens:0,costUsd:0,durationMs:0};summary.calls++;summary[record.status]++;summary.inputTokens+=record.inputTokens;summary.outputTokens+=record.outputTokens;summary.cachedInputTokens+=record.cachedInputTokens;summary.reasoningTokens+=record.reasoningTokens;summary.tokens+=record.tokens;summary.costUsd+=record.costUsd;summary.durationMs+=record.durationMs;groups.set(key,summary)}
  return [...groups.values()].sort((left,right)=>right.costUsd-left.costUsd||right.tokens-left.tokens||left.key.localeCompare(right.key))
}
function matches(record:UsageRecord,query:UsageQuery){return record.tenantId===query.tenantId&&(!query.userId||record.userId===query.userId)&&(!query.projectId||record.projectId===query.projectId)&&(!query.runId||record.runId===query.runId)&&(!query.capability||record.capability===query.capability)&&(!query.provider||record.provider===query.provider)&&(!query.model||record.model===query.model)&&(query.from===undefined||record.createdAt>=query.from)&&(query.to===undefined||record.createdAt<=query.to)}
function groupKey(record:UsageRecord,groupBy:UsageGroupBy){if(groupBy==='run')return record.runId;if(groupBy==='user')return record.userId;if(groupBy==='tenant')return record.tenantId;return record[groupBy]??'unknown'}
