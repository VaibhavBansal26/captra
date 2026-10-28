import { CAPTRA_PROTOCOL_VERSION,type CaptraEvent,type ChatMessage,type CheckpointRecord,type CheckpointStore,type Conversation,type ConversationMember,type ConversationMessage,type ConversationRole,type ConversationStatus,type ConversationStore,type CreateRun,type EffectClaim,type EffectReceipt,type EffectStore,type EmbeddingAdapter,type EvaluationHistoryQuery,type EvaluationReport,type EvaluationStore,type ExecutionIdentity,type MemoryAdapter,type MemoryIdentity,type MemoryRecallOptions,type MemoryRecord,type MemoryScope,type RunCompletionResult,type RunCompletionStore,type RunCompletionWrite,type RunRecord,type RunStore,type StoredEvaluationReport,type UsageGroupBy,type UsageInput,type UsageQuery,type UsageRecord,type UsageStore,type UsageSummary,type WorkItem,type WorkQueue } from '@captra-ai/core'
import { hashStateKey,StateConflictError,StateLeaseError,validateCommit,validateLease,validateLeaseRequest,type AcquireLeaseOptions,type CommitOptions,type SharedStateAdapter,type SharedStateEvent,type SharedStateSnapshot,type StateKey,type StateLease } from '@captra-ai/state'
import { postgresSchema,postgresVectorSchema } from './schema.js'

export { postgresSchema,postgresVectorSchema }
export type SqlResult<Row=Record<string,unknown>>={rows:Row[];rowCount?:number|null}
export interface SqlClient { query<Row=Record<string,unknown>>(text:string,values?:readonly unknown[]):Promise<SqlResult<Row>> }
export interface SqlConnection extends SqlClient{release():void}
export interface SqlPool extends SqlClient{connect():Promise<SqlConnection>}
export async function migrateCaptra(client:SqlClient){await client.query(postgresSchema)}
export async function migrateCaptraVectors(client:SqlClient,dimensions:number){await client.query(postgresVectorSchema(dimensions))}

type RunRow={id:string;app:string;app_version:string;capability:string;status:RunRecord['status'];tenant_id:string;user_id:string;project_id:string;session_id?:string;input:unknown;validated_input?:unknown;output?:unknown;approval?:RunRecord['approval'];approval_identity?:RunRecord['approvalIdentity'];error?:string;idempotency_key?:string;created_at:Date|string;updated_at:Date|string}
type EventRow={id:string;run_id:string;sequence:number;protocol:string;at:Date|string;type:CaptraEvent['type'];capability:string;detail:string;data?:unknown}
type MemoryRow={id:string;tenant_id:string;scope:MemoryScope;owner_id:string;type:MemoryRecord['type'];content:string;confidence:number;created_at:Date|string;expires_at?:Date|string}
type JobRow={id:string;run_id:string;attempts:number;max_attempts:number;available_at:Date|string;lease_until?:Date|string;leased_by?:string}
type CheckpointRow={id:string;run_id:string;key:string;sequence:number;state:unknown;created_at:Date|string}
type StateRow={key:StateKey;value:unknown;has_value:boolean;version:number|string;fence:number|string;lease_owner?:string;lease_until?:Date|string;updated_at:Date|string}
type StateEventRow={id:string;key:StateKey;type:SharedStateEvent['type'];actor:string;version:number|string;token?:number|string;at:Date|string}
type EffectRow={tenant_id:string;tool:string;key:string;status:EffectReceipt['status'];output?:unknown;error?:string;created_at:Date|string;updated_at:Date|string}
type UsageRow={id:string;run_id:string;tenant_id:string;user_id:string;project_id:string;capability:string;provider:string;model?:string;attempt:number;status:UsageRecord['status'];input_tokens:number|string;output_tokens:number|string;cached_input_tokens:number|string;reasoning_tokens:number|string;cost_usd:number|string;duration_ms:number|string;created_at:Date|string}
type EvaluationRow={id:string;tenant_id:string;project_id?:string;suite?:string;variant?:string;report:EvaluationReport;created_at:Date|string}
type ConversationMessageRow={sequence:number|string;tenant_id:string;conversation_id:string;id:string;user_id:string;role:ConversationMessage['role'];content:string;created_at:Date|string}
type ConversationRow={tenant_id:string;id:string;user_id:string;status:ConversationStatus;title?:string;labels?:string[];access?:ConversationRole;created_at:Date|string;updated_at:Date|string;archived_at?:Date|string}
type ConversationMemberRow={user_id:string;role:ConversationMember['role'];created_at:Date|string}
const millis=(value:Date|string)=>new Date(value).getTime()
const runFrom=(row:RunRow):RunRecord=>({id:row.id,app:row.app,appVersion:row.app_version,capability:row.capability,status:row.status,identity:{tenantId:row.tenant_id,userId:row.user_id,projectId:row.project_id,sessionId:row.session_id},input:row.input,validatedInput:row.validated_input,output:row.output,approval:row.approval,approvalIdentity:row.approval_identity,error:row.error,idempotencyKey:row.idempotency_key,createdAt:millis(row.created_at),updatedAt:millis(row.updated_at)})
const eventFrom=(row:EventRow):CaptraEvent=>({id:row.id,runId:row.run_id,sequence:row.sequence,protocol:CAPTRA_PROTOCOL_VERSION,at:millis(row.at),type:row.type,capability:row.capability,detail:row.detail,data:row.data})
const memoryFrom=(row:MemoryRow):MemoryRecord=>({id:row.id,tenantId:row.tenant_id,scope:row.scope,ownerId:row.owner_id,type:row.type,content:row.content,confidence:row.confidence,createdAt:millis(row.created_at),expiresAt:row.expires_at?millis(row.expires_at):undefined})
const jobFrom=(row:JobRow):WorkItem=>({id:row.id,runId:row.run_id,attempts:row.attempts,maxAttempts:row.max_attempts,availableAt:millis(row.available_at),leaseUntil:row.lease_until?millis(row.lease_until):undefined,leasedBy:row.leased_by})
const checkpointFrom=(row:CheckpointRow):CheckpointRecord=>({id:row.id,runId:row.run_id,key:row.key,sequence:row.sequence,state:row.state,createdAt:millis(row.created_at)})
const stateFrom=<T>(row:StateRow):SharedStateSnapshot<T>=>({key:row.key,value:row.has_value?row.value as T:undefined,version:Number(row.version),updatedAt:millis(row.updated_at)})
const stateEventFrom=(row:StateEventRow):SharedStateEvent=>({id:row.id,key:row.key,type:row.type,actor:row.actor,version:Number(row.version),at:millis(row.at),...(row.token===undefined?{}:{token:Number(row.token)})})
const usageFrom=(row:UsageRow):UsageRecord=>({id:row.id,runId:row.run_id,tenantId:row.tenant_id,userId:row.user_id,projectId:row.project_id,capability:row.capability,provider:row.provider,model:row.model,attempt:row.attempt,status:row.status,inputTokens:Number(row.input_tokens),outputTokens:Number(row.output_tokens),cachedInputTokens:Number(row.cached_input_tokens),reasoningTokens:Number(row.reasoning_tokens),tokens:Number(row.input_tokens)+Number(row.output_tokens),costUsd:Number(row.cost_usd),durationMs:Number(row.duration_ms),createdAt:millis(row.created_at)})
const evaluationFrom=(row:EvaluationRow):StoredEvaluationReport=>({id:row.id,tenantId:row.tenant_id,projectId:row.project_id,report:row.report,createdAt:millis(row.created_at)})
const conversationMessageFrom=(row:ConversationMessageRow):ConversationMessage=>({id:row.id,conversationId:row.conversation_id,tenantId:row.tenant_id,userId:row.user_id,role:row.role,content:row.content,createdAt:millis(row.created_at)})
const conversationFrom=(row:ConversationRow):Conversation=>({id:row.id,tenantId:row.tenant_id,userId:row.user_id,status:row.status,title:row.title??undefined,labels:row.labels??[],access:row.access??'owner',createdAt:millis(row.created_at),updatedAt:millis(row.updated_at),archivedAt:row.archived_at?millis(row.archived_at):undefined})
const conversationMemberFrom=(row:ConversationMemberRow):ConversationMember=>({userId:row.user_id,role:row.role,createdAt:millis(row.created_at)})

export class PostgresConversationStore implements ConversationStore{
  constructor(readonly client:SqlClient){}

  async append(conversationId:string,identity:ExecutionIdentity,messages:readonly ChatMessage[]){
    if(!conversationId)throw new Error('Conversation ID is required')
    if(!messages.length)return []
    const rows=messages.map((message,index)=>({id:message.id??crypto.randomUUID(),role:message.role,content:message.content,createdAt:Date.now()+index}))
    const result=await this.client.query<ConversationMessageRow>(`WITH owned AS (
      INSERT INTO captra_conversations (tenant_id,id,user_id) VALUES ($1,$2,$3)
      ON CONFLICT (tenant_id,id) DO UPDATE SET updated_at=now()
      WHERE captra_conversations.status='active' AND (captra_conversations.user_id=EXCLUDED.user_id OR EXISTS (SELECT 1 FROM captra_conversation_members member WHERE member.tenant_id=captra_conversations.tenant_id AND member.conversation_id=captra_conversations.id AND member.user_id=EXCLUDED.user_id AND member.role='editor'))
      RETURNING tenant_id,id,user_id
    ), incoming AS (
      SELECT * FROM jsonb_to_recordset($4::jsonb) AS message(id text,role text,content text,created_at timestamptz)
    )
    INSERT INTO captra_conversation_messages (tenant_id,conversation_id,id,user_id,role,content,created_at)
    SELECT owned.tenant_id,owned.id,incoming.id,owned.user_id,incoming.role,incoming.content,incoming.created_at
    FROM owned CROSS JOIN incoming
    ON CONFLICT (tenant_id,conversation_id,id) DO NOTHING
    RETURNING *`,[identity.tenantId,conversationId,identity.userId,JSON.stringify(rows.map(row=>({id:row.id,role:row.role,content:row.content,created_at:new Date(row.createdAt).toISOString()})))])
    if(!result.rows.length){
      const owned=await this.client.query<ConversationRow>(`SELECT * FROM captra_conversations WHERE tenant_id=$1 AND id=$2 AND (user_id=$3 OR EXISTS (SELECT 1 FROM captra_conversation_members member WHERE member.tenant_id=$1 AND member.conversation_id=$2 AND member.user_id=$3 AND member.role='editor'))`,[identity.tenantId,conversationId,identity.userId])
      if(!owned.rows[0])throw new Error('Conversation not found')
      if(owned.rows[0].status==='archived')throw new Error('Conversation is archived')
    }
    return result.rows.sort((left,right)=>Number(left.sequence)-Number(right.sequence)).map(conversationMessageFrom)
  }

  async list(conversationId:string,identity:ExecutionIdentity,options:{cursor?:string;limit?:number}={}){
    const limit=Math.max(1,Math.min(100,options.limit??30)),values:unknown[]=[identity.tenantId,conversationId,identity.userId]
    let cursor=''
    if(options.cursor){values.push(options.cursor);cursor=`AND messages.sequence<(SELECT cursor.sequence FROM captra_conversation_messages cursor WHERE cursor.tenant_id=$1 AND cursor.conversation_id=$2 AND cursor.id=$4)`}
    values.push(limit+1)
    const result=await this.client.query<ConversationMessageRow>(`SELECT messages.* FROM captra_conversation_messages messages
      JOIN captra_conversations conversations ON conversations.tenant_id=messages.tenant_id AND conversations.id=messages.conversation_id
      WHERE conversations.tenant_id=$1 AND conversations.id=$2 AND (conversations.user_id=$3 OR EXISTS (SELECT 1 FROM captra_conversation_members member WHERE member.tenant_id=$1 AND member.conversation_id=$2 AND member.user_id=$3)) ${cursor}
      ORDER BY messages.sequence DESC LIMIT $${values.length}`,values)
    if(!result.rows.length){
      const conversation=await this.client.query(`SELECT 1 FROM captra_conversations WHERE tenant_id=$1 AND id=$2 AND (user_id=$3 OR EXISTS (SELECT 1 FROM captra_conversation_members member WHERE member.tenant_id=$1 AND member.conversation_id=$2 AND member.user_id=$3))`,[identity.tenantId,conversationId,identity.userId])
      if(!conversation.rows[0]&&await this.exists(identity.tenantId,conversationId))throw new Error('Conversation not found')
    }
    const hasMore=result.rows.length>limit,selected=result.rows.slice(0,limit).reverse().map(conversationMessageFrom)
    return {items:selected,nextCursor:hasMore?selected[0]?.id:undefined}
  }

  async listConversations(identity:ExecutionIdentity,options:{cursor?:string;limit?:number;status?:ConversationStatus}={}){
    const limit=Math.max(1,Math.min(100,options.limit??30)),values:unknown[]=[identity.tenantId,identity.userId],clauses=[`conversations.tenant_id=$1`,`(conversations.user_id=$2 OR members.user_id=$2)`]
    if(options.status){values.push(options.status);clauses.push(`conversations.status=$${values.length}`)}
    if(options.cursor){values.push(options.cursor);clauses.push(`(conversations.updated_at,conversations.id)<(SELECT updated_at,id FROM captra_conversations WHERE tenant_id=$1 AND id=$${values.length})`)}
    values.push(limit+1);const result=await this.client.query<ConversationRow>(`SELECT conversations.*,CASE WHEN conversations.user_id=$2 THEN 'owner' ELSE members.role END AS access FROM captra_conversations conversations LEFT JOIN captra_conversation_members members ON members.tenant_id=conversations.tenant_id AND members.conversation_id=conversations.id AND members.user_id=$2 WHERE ${clauses.join(' AND ')} ORDER BY conversations.updated_at DESC,conversations.id DESC LIMIT $${values.length}`,values),hasMore=result.rows.length>limit,items=result.rows.slice(0,limit).map(conversationFrom)
    return {items,nextCursor:hasMore?items.at(-1)?.id:undefined}
  }

  async get(conversationId:string,identity:ExecutionIdentity){
    const result=await this.client.query<ConversationRow>(`SELECT conversations.*,CASE WHEN conversations.user_id=$3 THEN 'owner' ELSE members.role END AS access FROM captra_conversations conversations LEFT JOIN captra_conversation_members members ON members.tenant_id=conversations.tenant_id AND members.conversation_id=conversations.id AND members.user_id=$3 WHERE conversations.tenant_id=$1 AND conversations.id=$2 AND (conversations.user_id=$3 OR members.user_id=$3)`,[identity.tenantId,conversationId,identity.userId])
    if(result.rows[0])return conversationFrom(result.rows[0])
    if(await this.exists(identity.tenantId,conversationId))throw new Error('Conversation not found')
    return undefined
  }

  async update(conversationId:string,identity:ExecutionIdentity,patch:{title?:string|null;labels?:readonly string[]}){
    const result=await this.client.query<ConversationRow>(`UPDATE captra_conversations conversations SET title=CASE WHEN $4::boolean THEN $5 ELSE title END,labels=CASE WHEN $6::boolean THEN $7::jsonb ELSE labels END,updated_at=now() WHERE tenant_id=$1 AND id=$2 AND (user_id=$3 OR EXISTS (SELECT 1 FROM captra_conversation_members member WHERE member.tenant_id=$1 AND member.conversation_id=$2 AND member.user_id=$3 AND member.role='editor')) RETURNING conversations.*,CASE WHEN user_id=$3 THEN 'owner' ELSE 'editor' END AS access`,[identity.tenantId,conversationId,identity.userId,patch.title!==undefined,patch.title??null,patch.labels!==undefined,JSON.stringify([...new Set(patch.labels??[])])]);if(!result.rows[0])throw new Error('Conversation not found');return conversationFrom(result.rows[0])
  }

  async archive(conversationId:string,identity:ExecutionIdentity){return this.transition(conversationId,identity,'archived')}
  async restore(conversationId:string,identity:ExecutionIdentity){return this.transition(conversationId,identity,'active')}
  async members(conversationId:string,identity:ExecutionIdentity){await this.requireOwner(conversationId,identity);const result=await this.client.query<ConversationMemberRow>('SELECT user_id,role,created_at FROM captra_conversation_members WHERE tenant_id=$1 AND conversation_id=$2 ORDER BY created_at,user_id',[identity.tenantId,conversationId]);return result.rows.map(conversationMemberFrom)}
  async share(conversationId:string,identity:ExecutionIdentity,userId:string,role:Exclude<ConversationRole,'owner'>){await this.requireOwner(conversationId,identity);if(!userId||userId===identity.userId)throw new Error('Invalid conversation member');const result=await this.client.query<ConversationMemberRow>('INSERT INTO captra_conversation_members (tenant_id,conversation_id,user_id,role) VALUES ($1,$2,$3,$4) ON CONFLICT (tenant_id,conversation_id,user_id) DO UPDATE SET role=EXCLUDED.role RETURNING user_id,role,created_at',[identity.tenantId,conversationId,userId,role]);return conversationMemberFrom(result.rows[0])}
  async unshare(conversationId:string,identity:ExecutionIdentity,userId:string){await this.requireOwner(conversationId,identity);const result=await this.client.query('DELETE FROM captra_conversation_members WHERE tenant_id=$1 AND conversation_id=$2 AND user_id=$3',[identity.tenantId,conversationId,userId]);return (result.rowCount??0)>0}
  async transfer(conversationId:string,identity:ExecutionIdentity,newOwnerId:string){if(!newOwnerId||newOwnerId===identity.userId)throw new Error('Invalid conversation owner');const result=await this.client.query<ConversationRow>(`WITH moved AS (UPDATE captra_conversations SET user_id=$4,updated_at=now() WHERE tenant_id=$1 AND id=$2 AND user_id=$3 RETURNING *), old_owner AS (INSERT INTO captra_conversation_members (tenant_id,conversation_id,user_id,role) SELECT tenant_id,id,$3,'editor' FROM moved ON CONFLICT (tenant_id,conversation_id,user_id) DO UPDATE SET role='editor'), removed AS (DELETE FROM captra_conversation_members WHERE tenant_id=$1 AND conversation_id=$2 AND user_id=$4) SELECT moved.*,'editor' AS access FROM moved`,[identity.tenantId,conversationId,identity.userId,newOwnerId]);if(!result.rows[0])throw new Error('Conversation not found');return conversationFrom(result.rows[0])}
  async delete(conversationId:string,identity:ExecutionIdentity){
    const result=await this.client.query('DELETE FROM captra_conversations WHERE tenant_id=$1 AND id=$2 AND user_id=$3',[identity.tenantId,conversationId,identity.userId])
    if((result.rowCount??0)>0)return true
    if(await this.exists(identity.tenantId,conversationId))throw new Error('Conversation not found')
    return false
  }

  async purgeArchived(tenantId:string,before:number,limit=1_000){
    if(!tenantId)throw new Error('Conversation retention requires tenantId')
    if(!Number.isFinite(before))throw new Error('Conversation retention before must be finite')
    if(!Number.isSafeInteger(limit)||limit<1||limit>10_000)throw new Error('Conversation retention limit must be between 1 and 10000')
    const result=await this.client.query(`DELETE FROM captra_conversations WHERE ctid IN (
      SELECT ctid FROM captra_conversations WHERE tenant_id=$1 AND status='archived' AND archived_at<to_timestamp($2/1000.0)
      ORDER BY archived_at,id LIMIT $3 FOR UPDATE SKIP LOCKED
    )`,[tenantId,before,limit])
    return result.rowCount??0
  }

  private async transition(conversationId:string,identity:ExecutionIdentity,status:ConversationStatus){
    const result=await this.client.query<ConversationRow>(`UPDATE captra_conversations SET status=$4,archived_at=CASE WHEN $4='archived' THEN now() ELSE NULL END,updated_at=now()
      WHERE tenant_id=$1 AND id=$2 AND user_id=$3 RETURNING *`,[identity.tenantId,conversationId,identity.userId,status])
    if(result.rows[0])return conversationFrom(result.rows[0])
    throw new Error('Conversation not found')
  }

  private async exists(tenantId:string,conversationId:string){const result=await this.client.query('SELECT 1 FROM captra_conversations WHERE tenant_id=$1 AND id=$2',[tenantId,conversationId]);return Boolean(result.rows[0])}
  private async requireOwner(conversationId:string,identity:ExecutionIdentity){const result=await this.client.query('SELECT 1 FROM captra_conversations WHERE tenant_id=$1 AND id=$2 AND user_id=$3',[identity.tenantId,conversationId,identity.userId]);if(!result.rows[0])throw new Error('Conversation not found')}
}

export class PostgresRunStore implements RunStore{
  constructor(readonly client:SqlClient){}
  async create(input:CreateRun){const id=crypto.randomUUID();const {identity}=input;const result=await this.client.query<RunRow>(`INSERT INTO captra_runs (id,app,app_version,capability,status,tenant_id,user_id,project_id,session_id,input,idempotency_key) VALUES ($1,$2,$3,$4,'created',$5,$6,$7,$8,$9::jsonb,$10) ON CONFLICT (tenant_id,idempotency_key) WHERE idempotency_key IS NOT NULL DO UPDATE SET updated_at=captra_runs.updated_at RETURNING *`,[id,input.app,input.appVersion,input.capability,identity.tenantId,identity.userId,identity.projectId,identity.sessionId??null,JSON.stringify(input.input),input.idempotencyKey??null]);return runFrom(result.rows[0])}
  async get(id:string){const result=await this.client.query<RunRow>('SELECT * FROM captra_runs WHERE id=$1',[id]);return result.rows[0]?runFrom(result.rows[0]):undefined}
  async update(id:string,patch:Partial<RunRecord>){const {entries,set}=runPatch(patch);if(!entries.length)return;const result=await this.client.query(`UPDATE captra_runs SET ${set},updated_at=now() WHERE id=$1`,[id,...entries.map(([,value])=>value)]);if(result.rowCount===0)throw new Error(`Unknown run: ${id}`)}
  async compareAndSet(id:string,expected:readonly RunRecord['status'][],patch:Partial<RunRecord>){const {entries,set}=runPatch(patch);if(!entries.length)return this.get(id);const statusIndex=entries.length+2,result=await this.client.query<RunRow>(`UPDATE captra_runs SET ${set},updated_at=now() WHERE id=$1 AND status=ANY($${statusIndex}::text[]) RETURNING *`,[id,...entries.map(([,value])=>value),expected]);return result.rows[0]?runFrom(result.rows[0]):undefined}
  async appendEvent(runId:string,event:Omit<CaptraEvent,'id'|'protocol'|'runId'|'sequence'|'at'>){for(let attempt=0;attempt<64;attempt++){const result=await this.client.query<EventRow>(`INSERT INTO captra_events (id,run_id,sequence,protocol,type,capability,detail,data) SELECT $1,$2,COALESCE(MAX(events.sequence),0)+1,$3,$4,$5,$6,$7::jsonb FROM captra_runs runs LEFT JOIN captra_events events ON events.run_id=runs.id WHERE runs.id=$2 GROUP BY runs.id ON CONFLICT (run_id,sequence) DO NOTHING RETURNING *`,[crypto.randomUUID(),runId,CAPTRA_PROTOCOL_VERSION,event.type,event.capability,event.detail,JSON.stringify(event.data??null)]);if(result.rows[0])return eventFrom(result.rows[0]);if(!(await this.get(runId)))throw new Error(`Unknown run: ${runId}`);await new Promise(resolve=>setTimeout(resolve,attempt%4))}throw new Error(`Event sequence contention for run: ${runId}`)}
  async events(id:string,after=0){const result=await this.client.query<EventRow>('SELECT * FROM captra_events WHERE run_id=$1 AND sequence>$2 ORDER BY sequence',[id,after]);return result.rows.map(eventFrom)}
  async findByIdempotencyKey(tenantId:string,key:string){const result=await this.client.query<RunRow>('SELECT * FROM captra_runs WHERE tenant_id=$1 AND idempotency_key=$2 LIMIT 1',[tenantId,key]);return result.rows[0]?runFrom(result.rows[0]):undefined}
}

/** Atomically publishes staged chat messages and usage with the terminal run and completion event. */
export class PostgresRunCompletionStore implements RunCompletionStore{
  constructor(readonly pool:SqlPool){}

  async commit(write:RunCompletionWrite):Promise<RunCompletionResult>{
    const client=await this.pool.connect()
    try{
      await client.query('BEGIN')
      const locked=await client.query<RunRow>('SELECT * FROM captra_runs WHERE id=$1 FOR UPDATE',[write.runId]),current=locked.rows[0]
      if(!current)throw new Error(`Unknown run: ${write.runId}`)
      if(current.status!=='running')throw new Error(`Run ${write.runId} is no longer running`)
      for(const item of write.conversations)await appendConversation(client,item.conversationId,item.identity,item.messages)
      for(const item of write.usage)await insertUsage(client,item)
      const updated=await client.query<RunRow>(`UPDATE captra_runs SET status='completed',output=$2::jsonb,error=NULL,updated_at=now() WHERE id=$1 AND status='running' RETURNING *`,[write.runId,JSON.stringify(write.output)])
      if(!updated.rows[0])throw new Error(`Run ${write.runId} is no longer running`)
      const saved=await client.query<EventRow>(`INSERT INTO captra_events (id,run_id,sequence,protocol,type,capability,detail,data)
        SELECT $1,$2,COALESCE(MAX(events.sequence),0)+1,$3,'run.completed',$4,$5,$6::jsonb
        FROM captra_runs runs LEFT JOIN captra_events events ON events.run_id=runs.id WHERE runs.id=$2 GROUP BY runs.id RETURNING *`,[crypto.randomUUID(),write.runId,CAPTRA_PROTOCOL_VERSION,write.capability,write.view,JSON.stringify({view:write.view})])
      await client.query('COMMIT')
      return {run:runFrom(updated.rows[0]),event:eventFrom(saved.rows[0])}
    }catch(error){
      try{await client.query('ROLLBACK')}catch{}
      throw error
    }finally{client.release()}
  }
}

export class PostgresEffectStore implements EffectStore{
  constructor(readonly client:SqlClient){}
  async claim(tenantId:string,tool:string,key:string):Promise<EffectClaim>{const inserted=await this.client.query<EffectRow>(`INSERT INTO captra_effects (tenant_id,tool,key,status) VALUES ($1,$2,$3,'started') ON CONFLICT DO NOTHING RETURNING *`,[tenantId,tool,key]);if(inserted.rows[0])return {status:'claimed'};const found=await this.client.query<EffectRow>('SELECT * FROM captra_effects WHERE tenant_id=$1 AND tool=$2 AND key=$3',[tenantId,tool,key]),receipt=effectFrom(found.rows[0]);if(receipt.status==='completed')return {status:'completed',output:receipt.output};return {status:'in_doubt',receipt}}
  async complete(tenantId:string,tool:string,key:string,output:unknown){const result=await this.client.query(`UPDATE captra_effects SET status='completed',output=$4::jsonb,error=NULL,updated_at=now() WHERE tenant_id=$1 AND tool=$2 AND key=$3 AND status='started'`,[tenantId,tool,key,JSON.stringify(output)]);if(result.rowCount===0)throw new Error(`Effect was not claimed: ${tool}/${key}`)}
  async doubt(tenantId:string,tool:string,key:string,error:string){const result=await this.client.query(`UPDATE captra_effects SET status='in_doubt',error=$4,updated_at=now() WHERE tenant_id=$1 AND tool=$2 AND key=$3 AND status='started'`,[tenantId,tool,key,error]);if(result.rowCount===0)throw new Error(`Effect was not claimed: ${tool}/${key}`)}
}

export class PostgresUsageStore implements UsageStore{
  constructor(readonly client:SqlClient){}
  async record(input:UsageInput){const result=await this.client.query<UsageRow>(`INSERT INTO captra_usage (id,run_id,tenant_id,user_id,project_id,capability,provider,model,attempt,status,input_tokens,output_tokens,cached_input_tokens,reasoning_tokens,cost_usd,duration_ms,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,to_timestamp($17/1000.0)) ON CONFLICT (id) DO UPDATE SET id=EXCLUDED.id RETURNING *`,[input.id??crypto.randomUUID(),input.runId,input.tenantId,input.userId,input.projectId,input.capability,input.provider,input.model??null,input.attempt,input.status,input.inputTokens,input.outputTokens,input.cachedInputTokens,input.reasoningTokens,input.costUsd,input.durationMs,input.createdAt??Date.now()]);return usageFrom(result.rows[0])}
  async query(query:UsageQuery){const {where,values}=usageFilter(query);values.push(Math.min(query.limit??1000,10_000));const result=await this.client.query<UsageRow>(`SELECT * FROM captra_usage WHERE ${where} ORDER BY created_at DESC,id LIMIT $${values.length}`,values);return result.rows.map(usageFrom)}
  async summarize(query:UsageQuery,groupBy:UsageGroupBy){const columns:Record<UsageGroupBy,string>={run:'run_id',capability:'capability',user:'user_id',tenant:'tenant_id',provider:'provider',model:"COALESCE(model,'unknown')"},column=columns[groupBy],{where,values}=usageFilter(query),result=await this.client.query<{key:string;calls:number|string;succeeded:number|string;failed:number|string;skipped:number|string;input_tokens:number|string;output_tokens:number|string;cached_input_tokens:number|string;reasoning_tokens:number|string;tokens:number|string;cost_usd:number|string;duration_ms:number|string}>(`SELECT ${column} AS key,COUNT(*) AS calls,COUNT(*) FILTER (WHERE status='succeeded') AS succeeded,COUNT(*) FILTER (WHERE status='failed') AS failed,COUNT(*) FILTER (WHERE status='skipped') AS skipped,COALESCE(SUM(input_tokens),0) AS input_tokens,COALESCE(SUM(output_tokens),0) AS output_tokens,COALESCE(SUM(cached_input_tokens),0) AS cached_input_tokens,COALESCE(SUM(reasoning_tokens),0) AS reasoning_tokens,COALESCE(SUM(input_tokens+output_tokens),0) AS tokens,COALESCE(SUM(cost_usd),0) AS cost_usd,COALESCE(SUM(duration_ms),0) AS duration_ms FROM captra_usage WHERE ${where} GROUP BY ${column} ORDER BY cost_usd DESC,tokens DESC`,values);return result.rows.map(row=>({key:row.key,calls:Number(row.calls),succeeded:Number(row.succeeded),failed:Number(row.failed),skipped:Number(row.skipped),inputTokens:Number(row.input_tokens),outputTokens:Number(row.output_tokens),cachedInputTokens:Number(row.cached_input_tokens),reasoningTokens:Number(row.reasoning_tokens),tokens:Number(row.tokens),costUsd:Number(row.cost_usd),durationMs:Number(row.duration_ms)} satisfies UsageSummary))}
}

async function insertUsage(client:SqlClient,input:UsageInput){return client.query<UsageRow>(`INSERT INTO captra_usage (id,run_id,tenant_id,user_id,project_id,capability,provider,model,attempt,status,input_tokens,output_tokens,cached_input_tokens,reasoning_tokens,cost_usd,duration_ms,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,to_timestamp($17/1000.0)) ON CONFLICT (id) DO UPDATE SET id=EXCLUDED.id RETURNING *`,[input.id??crypto.randomUUID(),input.runId,input.tenantId,input.userId,input.projectId,input.capability,input.provider,input.model??null,input.attempt,input.status,input.inputTokens,input.outputTokens,input.cachedInputTokens,input.reasoningTokens,input.costUsd,input.durationMs,input.createdAt??Date.now()])}

async function appendConversation(client:SqlClient,conversationId:string,identity:ExecutionIdentity,messages:readonly ChatMessage[]){
  const rows=messages.map((message,index)=>({id:message.id??crypto.randomUUID(),role:message.role,content:message.content,created_at:new Date(Date.now()+index).toISOString()}))
  const result=await client.query<ConversationMessageRow>(`WITH owned AS (
    INSERT INTO captra_conversations (tenant_id,id,user_id) VALUES ($1,$2,$3)
    ON CONFLICT (tenant_id,id) DO UPDATE SET updated_at=now()
    WHERE captra_conversations.status='active' AND (captra_conversations.user_id=EXCLUDED.user_id OR EXISTS (SELECT 1 FROM captra_conversation_members member WHERE member.tenant_id=captra_conversations.tenant_id AND member.conversation_id=captra_conversations.id AND member.user_id=EXCLUDED.user_id AND member.role='editor'))
    RETURNING tenant_id,id,user_id
  ), incoming AS (SELECT * FROM jsonb_to_recordset($4::jsonb) AS message(id text,role text,content text,created_at timestamptz))
  INSERT INTO captra_conversation_messages (tenant_id,conversation_id,id,user_id,role,content,created_at)
  SELECT owned.tenant_id,owned.id,incoming.id,owned.user_id,incoming.role,incoming.content,incoming.created_at FROM owned CROSS JOIN incoming
  ON CONFLICT (tenant_id,conversation_id,id) DO NOTHING RETURNING *`,[identity.tenantId,conversationId,identity.userId,JSON.stringify(rows)])
  if(result.rows.length===messages.length)return
  const owned=await client.query<ConversationRow>(`SELECT * FROM captra_conversations WHERE tenant_id=$1 AND id=$2 AND (user_id=$3 OR EXISTS (SELECT 1 FROM captra_conversation_members member WHERE member.tenant_id=$1 AND member.conversation_id=$2 AND member.user_id=$3 AND member.role='editor'))`,[identity.tenantId,conversationId,identity.userId])
  if(!owned.rows[0])throw new Error('Conversation not found')
  if(owned.rows[0].status==='archived')throw new Error('Conversation is archived')
}

export class PostgresEvaluationStore implements EvaluationStore{
  constructor(readonly client:SqlClient){}
  async save(input:Omit<StoredEvaluationReport,'id'|'createdAt'>){const result=await this.client.query<EvaluationRow>(`INSERT INTO captra_evaluation_reports (id,tenant_id,project_id,suite,variant,report) VALUES ($1,$2,$3,$4,$5,$6::jsonb) RETURNING *`,[crypto.randomUUID(),input.tenantId,input.projectId??null,input.report.suite??null,input.report.variant??null,JSON.stringify(input.report)]);return evaluationFrom(result.rows[0])}
  async list(query:EvaluationHistoryQuery){const values:unknown[]=[query.tenantId],clauses=['tenant_id=$1'];for(const [column,value] of [['project_id',query.projectId],['suite',query.suite],['variant',query.variant]] as const)if(value!==undefined){values.push(value);clauses.push(`${column}=$${values.length}`)}values.push(Math.min(query.limit??100,1000));const result=await this.client.query<EvaluationRow>(`SELECT * FROM captra_evaluation_reports WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC,id LIMIT $${values.length}`,values);return result.rows.map(evaluationFrom)}
}
function usageFilter(query:UsageQuery){const values:unknown[]=[query.tenantId],clauses=['tenant_id=$1'];for(const [column,value] of [['user_id',query.userId],['project_id',query.projectId],['run_id',query.runId],['capability',query.capability],['provider',query.provider],['model',query.model]] as const)if(value!==undefined){values.push(value);clauses.push(`${column}=$${values.length}`)}if(query.from!==undefined){values.push(query.from);clauses.push(`created_at>=to_timestamp($${values.length}/1000.0)`)}if(query.to!==undefined){values.push(query.to);clauses.push(`created_at<=to_timestamp($${values.length}/1000.0)`)}return {where:clauses.join(' AND '),values}}

export class PostgresMemoryStore implements MemoryAdapter{
  constructor(readonly client:SqlClient){}
  async remember(record:Omit<MemoryRecord,'id'|'createdAt'>){if(!record.tenantId)throw new Error('Postgres memory requires tenantId');const id=crypto.randomUUID();const result=await this.client.query<MemoryRow>('INSERT INTO captra_memories (id,tenant_id,scope,owner_id,type,content,confidence,expires_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *',[id,record.tenantId,record.scope,record.ownerId,record.type,record.content,record.confidence,record.expiresAt?new Date(record.expiresAt):null]);return memoryFrom(result.rows[0])}
  async recall(scopes:readonly MemoryScope[],identity:MemoryIdentity,options:MemoryRecallOptions={}){if(!identity.tenantId||!scopes.length)return [];const owners=scopes.map(scope=>scope==='organization'?identity.tenantId:scope==='user'?identity.userId:scope==='project'?identity.projectId:scope==='session'?identity.sessionId:identity.taskId??identity.runId);const pairs=scopes.map((scope,index)=>`(scope=$${index*2+2} AND owner_id=$${index*2+3})`).join(' OR ');const values:unknown[]=[identity.tenantId];scopes.forEach((scope,index)=>values.push(scope,owners[index]??'__none__'));const queryIndex=values.length+1,confidenceIndex=queryIndex+1,limitIndex=queryIndex+2;values.push(options.query??null,options.minConfidence??0,options.limit??100);const result=await this.client.query<MemoryRow>(`SELECT * FROM captra_memories WHERE tenant_id=$1 AND (${pairs}) AND (expires_at IS NULL OR expires_at>now()) AND confidence>=$${confidenceIndex} AND ($${queryIndex}::text IS NULL OR to_tsvector('simple',content) @@ plainto_tsquery('simple',$${queryIndex})) ORDER BY CASE WHEN $${queryIndex}::text IS NULL THEN 0 ELSE ts_rank(to_tsvector('simple',content),plainto_tsquery('simple',$${queryIndex})) END DESC,confidence DESC,created_at DESC LIMIT $${limitIndex}`,values);return result.rows.map(memoryFrom)}
  async forget(id:string,identity:MemoryIdentity){if(!identity.tenantId)return false;const result=await this.client.query('DELETE FROM captra_memories WHERE id=$1 AND tenant_id=$2',[id,identity.tenantId]);return (result.rowCount??0)>0}
}

export class PostgresCheckpointStore implements CheckpointStore{
  constructor(readonly client:SqlClient){}
  async save(runId:string,key:string,state:unknown){for(let attempt=0;attempt<64;attempt++){const result=await this.client.query<CheckpointRow>(`INSERT INTO captra_checkpoints (id,run_id,key,sequence,state) SELECT $1,$2,$3,COALESCE(MAX(checkpoints.sequence),0)+1,$4::jsonb FROM captra_runs runs LEFT JOIN captra_checkpoints checkpoints ON checkpoints.run_id=runs.id WHERE runs.id=$2 GROUP BY runs.id ON CONFLICT (run_id,sequence) DO NOTHING RETURNING *`,[crypto.randomUUID(),runId,key,JSON.stringify(state)]);if(result.rows[0])return checkpointFrom(result.rows[0]);const run=await this.client.query('SELECT id FROM captra_runs WHERE id=$1',[runId]);if(!run.rows[0])throw new Error(`Unknown run: ${runId}`);await new Promise(resolve=>setTimeout(resolve,attempt%4))}throw new Error(`Checkpoint sequence contention for run: ${runId}`)}
  async load(runId:string,key:string){const result=await this.client.query<CheckpointRow>('SELECT * FROM captra_checkpoints WHERE run_id=$1 AND key=$2 ORDER BY sequence DESC LIMIT 1',[runId,key]);return result.rows[0]?checkpointFrom(result.rows[0]):undefined}
  async list(runId:string){const result=await this.client.query<CheckpointRow>('SELECT * FROM captra_checkpoints WHERE run_id=$1 ORDER BY sequence',[runId]);return result.rows.map(checkpointFrom)}
}

export class PostgresWorkQueue implements WorkQueue{
  constructor(readonly client:SqlClient){}
  async enqueue(input:{runId:string;maxAttempts?:number;availableAt?:number}){const result=await this.client.query<JobRow>(`INSERT INTO captra_jobs (id,run_id,max_attempts,available_at) VALUES ($1,$2,$3,to_timestamp($4/1000.0)) ON CONFLICT (run_id) DO UPDATE SET run_id=EXCLUDED.run_id RETURNING *`,[crypto.randomUUID(),input.runId,input.maxAttempts??3,input.availableAt??Date.now()]);return jobFrom(result.rows[0])}
  async claim(workerId:string,leaseMs:number){const result=await this.client.query<JobRow>(`UPDATE captra_jobs SET status='leased',leased_by=$1,lease_until=now()+($2*interval '1 millisecond'),attempts=attempts+1,updated_at=now() WHERE id=(SELECT id FROM captra_jobs WHERE (status='queued' OR (status='leased' AND lease_until<=now())) AND available_at<=now() AND attempts<max_attempts ORDER BY available_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING *`,[workerId,leaseMs]);return result.rows[0]?jobFrom(result.rows[0]):undefined}
  async ack(id:string,workerId:string){const result=await this.client.query('DELETE FROM captra_jobs WHERE id=$1 AND leased_by=$2',[id,workerId]);return (result.rowCount??0)>0}
  async release(id:string,workerId:string,delayMs:number){const result=await this.client.query(`UPDATE captra_jobs SET status='queued',available_at=now()+($3*interval '1 millisecond'),leased_by=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND leased_by=$2`,[id,workerId,delayMs]);return (result.rowCount??0)>0}
  async fail(id:string,workerId:string,error:string){const result=await this.client.query(`UPDATE captra_jobs SET status='dead',error=$3,leased_by=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND leased_by=$2`,[id,workerId,error]);return (result.rowCount??0)>0}
  async heartbeat(id:string,workerId:string,leaseMs:number){const result=await this.client.query(`UPDATE captra_jobs SET lease_until=now()+($3*interval '1 millisecond'),updated_at=now() WHERE id=$1 AND leased_by=$2 AND status='leased'`,[id,workerId,leaseMs]);return (result.rowCount??0)>0}
}

export class PostgresSharedStateAdapter implements SharedStateAdapter{
  constructor(readonly client:SqlClient,readonly tenantId:string){if(!tenantId)throw new Error('Postgres shared state requires tenantId')}
  async read<T>(key:StateKey):Promise<SharedStateSnapshot<T>>{const result=await this.client.query<StateRow>('SELECT key,value,has_value,version,fence,lease_owner,lease_until,updated_at FROM captra_shared_state WHERE tenant_id=$1 AND key_hash=$2',[this.tenantId,hashStateKey(key)]);return result.rows[0]?stateFrom<T>(result.rows[0]):{key,value:undefined,version:0,updatedAt:0}}
  async commit<T>(key:StateKey,value:T,options:CommitOptions):Promise<SharedStateSnapshot<T>>{
    validateCommit(key,options)
    const lease=options.lease,hash=hashStateKey(key),id=crypto.randomUUID(),serialized=JSON.stringify(value)
    const result=lease
      ?await this.client.query<StateRow>(`WITH committed AS (
        UPDATE captra_shared_state SET value=$3::jsonb,has_value=true,version=version+1,updated_at=now()
        WHERE tenant_id=$1 AND key_hash=$2 AND version=$4 AND fence=$5 AND lease_owner=$6 AND lease_until>now() RETURNING *
      ), audited AS (
        INSERT INTO captra_state_events (id,tenant_id,key_hash,key,type,actor,version,token)
        SELECT $7,$1,$2,key,'state.committed',$8,version,$5 FROM committed
      ) SELECT * FROM committed`,[this.tenantId,hash,serialized,options.expectedVersion,lease.token,lease.owner,id,options.actor])
      :await this.client.query<StateRow>(`WITH committed AS (
        INSERT INTO captra_shared_state (tenant_id,key_hash,key,value,has_value,version) SELECT $1,$2,$3::jsonb,$4::jsonb,true,1 WHERE $5=0
        ON CONFLICT (tenant_id,key_hash) DO UPDATE SET value=EXCLUDED.value,has_value=true,version=captra_shared_state.version+1,updated_at=now()
        WHERE captra_shared_state.version=$5 RETURNING *
      ), audited AS (
        INSERT INTO captra_state_events (id,tenant_id,key_hash,key,type,actor,version)
        SELECT $6,$1,$2,key,'state.committed',$7,version FROM committed
      ) SELECT * FROM committed`,[this.tenantId,hash,JSON.stringify(key),serialized,options.expectedVersion,id,options.actor])
    if(result.rows[0])return stateFrom<T>(result.rows[0])
    const current=await this.read<T>(key)
    if(current.version!==options.expectedVersion){await this.record(key,'state.conflict',options.actor,current.version,lease?.token);throw new StateConflictError(key,options.expectedVersion,current.version)}
    throw new StateLeaseError('Lease is missing, expired, or has been superseded')
  }
  async acquire(key:StateKey,options:AcquireLeaseOptions):Promise<StateLease>{const ttlMs=validateLeaseRequest(options),{owner}=options,hash=hashStateKey(key),result=await this.client.query<StateRow>(`WITH leased AS (
    INSERT INTO captra_shared_state (tenant_id,key_hash,key,fence,lease_owner,lease_until) VALUES ($1,$2,$3::jsonb,1,$4,now()+($5*interval '1 millisecond'))
    ON CONFLICT (tenant_id,key_hash) DO UPDATE SET fence=captra_shared_state.fence+1,lease_owner=$4,lease_until=now()+($5*interval '1 millisecond'),updated_at=now()
    WHERE captra_shared_state.lease_until IS NULL OR captra_shared_state.lease_until<=now()
    RETURNING *
  ), audited AS (
    INSERT INTO captra_state_events (id,tenant_id,key_hash,key,type,actor,version,token)
    SELECT $6,$1,$2,key,'lease.acquired',$4,version,fence FROM leased
  ) SELECT * FROM leased`,[this.tenantId,hash,JSON.stringify(key),owner,ttlMs,crypto.randomUUID()]);const row=result.rows[0];if(!row)throw new StateLeaseError('State is already leased');return{key,owner,token:Number(row.fence),expiresAt:millis(row.lease_until!)}}
  async renew(lease:StateLease,ttlMs?:number):Promise<StateLease>{validateLease(lease);const duration=validateLeaseRequest({owner:lease.owner,ttlMs}),result=await this.client.query<StateRow>(`WITH renewed AS (UPDATE captra_shared_state SET lease_until=now()+($5*interval '1 millisecond'),updated_at=now() WHERE tenant_id=$1 AND key_hash=$2 AND fence=$3 AND lease_owner=$4 AND lease_until>now() RETURNING *), audited AS (INSERT INTO captra_state_events (id,tenant_id,key_hash,key,type,actor,version,token) SELECT $6,$1,$2,key,'lease.renewed',$4,version,fence FROM renewed) SELECT * FROM renewed`,[this.tenantId,hashStateKey(lease.key),lease.token,lease.owner,duration,crypto.randomUUID()]);const row=result.rows[0];if(!row)throw new StateLeaseError('Lease is missing, expired, or has been superseded');return{...lease,expiresAt:millis(row.lease_until!)}}
  async release(lease:StateLease){validateLease(lease);const result=await this.client.query<StateRow>(`WITH released AS (UPDATE captra_shared_state SET lease_owner=NULL,lease_until=NULL,updated_at=now() WHERE tenant_id=$1 AND key_hash=$2 AND fence=$3 AND lease_owner=$4 AND lease_until>now() RETURNING *), audited AS (INSERT INTO captra_state_events (id,tenant_id,key_hash,key,type,actor,version,token) SELECT $5,$1,$2,key,'lease.released',$4,version,fence FROM released) SELECT * FROM released`,[this.tenantId,hashStateKey(lease.key),lease.token,lease.owner,crypto.randomUUID()]);if(!result.rows[0])throw new StateLeaseError('Lease is missing, expired, or has been superseded')}
  async history(key:StateKey){const result=await this.client.query<StateEventRow>('SELECT id,key,type,actor,version,token,at FROM captra_state_events WHERE tenant_id=$1 AND key_hash=$2 ORDER BY at,id',[this.tenantId,hashStateKey(key)]);return result.rows.map(stateEventFrom)}
  private async record(key:StateKey,type:SharedStateEvent['type'],actor:string,version:number,token?:number){await this.client.query('INSERT INTO captra_state_events (id,tenant_id,key_hash,key,type,actor,version,token) VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8)',[crypto.randomUUID(),this.tenantId,hashStateKey(key),JSON.stringify(key),type,actor,version,token??null])}
}

export class PostgresSemanticMemoryStore implements MemoryAdapter{
  readonly base:PostgresMemoryStore
  constructor(readonly client:SqlClient,readonly embeddings:EmbeddingAdapter,readonly options:{dimensions:number;limit?:number;minSimilarity?:number;deduplicateSimilarity?:number}){this.base=new PostgresMemoryStore(client)}
  async remember(record:Omit<MemoryRecord,'id'|'createdAt'>){if(!record.tenantId)throw new Error('Postgres memory requires tenantId');const [embedding]=await this.embeddings.embed([record.content]);this.#validate(embedding);const duplicate=await this.client.query<MemoryRow>(`SELECT m.* FROM captra_memories m JOIN captra_memory_vectors v ON v.memory_id=m.id WHERE m.tenant_id=$1 AND m.scope=$2 AND m.owner_id=$3 AND m.type=$4 AND (m.expires_at IS NULL OR m.expires_at>now()) AND 1-(v.embedding <=> $5::vector)>=$6 ORDER BY v.embedding <=> $5::vector LIMIT 1`,[record.tenantId,record.scope,record.ownerId,record.type,vectorLiteral(embedding),this.options.deduplicateSimilarity??.98]);if(duplicate.rows[0])return memoryFrom(duplicate.rows[0]);const saved=await this.base.remember(record);await this.client.query('INSERT INTO captra_memory_vectors (memory_id,embedding) VALUES ($1,$2::vector)',[saved.id,vectorLiteral(embedding)]);return saved}
  async recall(scopes:readonly MemoryScope[],identity:MemoryIdentity,options:MemoryRecallOptions={}){if(!options.query)return this.base.recall(scopes,identity,{...options,limit:options.limit??this.options.limit});if(!identity.tenantId||!scopes.length)return [];const [embedding]=await this.embeddings.embed([options.query]);this.#validate(embedding);const owners=scopes.map(scope=>scope==='organization'?identity.tenantId:scope==='user'?identity.userId:scope==='project'?identity.projectId:scope==='session'?identity.sessionId:identity.taskId??identity.runId),pairs=scopes.map((scope,index)=>`(m.scope=$${index*2+2} AND m.owner_id=$${index*2+3})`).join(' OR '),values:unknown[]=[identity.tenantId];scopes.forEach((scope,index)=>values.push(scope,owners[index]??'__none__'));const vectorIndex=values.length+1,confidenceIndex=vectorIndex+1,similarityIndex=vectorIndex+2,limitIndex=vectorIndex+3;values.push(vectorLiteral(embedding),options.minConfidence??0,this.options.minSimilarity??0,options.limit??this.options.limit??20);const result=await this.client.query<MemoryRow>(`SELECT m.* FROM captra_memories m JOIN captra_memory_vectors v ON v.memory_id=m.id WHERE m.tenant_id=$1 AND (${pairs}) AND (m.expires_at IS NULL OR m.expires_at>now()) AND m.confidence>=$${confidenceIndex} AND 1-(v.embedding <=> $${vectorIndex}::vector)>=$${similarityIndex} ORDER BY v.embedding <=> $${vectorIndex}::vector,m.confidence DESC LIMIT $${limitIndex}`,values);return result.rows.map(memoryFrom)}
  forget(id:string,identity:MemoryIdentity){return this.base.forget(id,identity)}
  #validate(vector:readonly number[]){if(vector.length!==this.options.dimensions)throw new Error(`Expected ${this.options.dimensions} embedding dimensions, received ${vector.length}`);if(vector.some(value=>!Number.isFinite(value)))throw new Error('Embedding contains a non-finite number')}
}
function vectorLiteral(vector:readonly number[]){return `[${vector.join(',')}]`}
function runPatch(patch:Partial<RunRecord>){const fields:Record<string,unknown>={status:patch.status,validated_input:patch.validatedInput===undefined?undefined:JSON.stringify(patch.validatedInput),output:patch.output===undefined?undefined:JSON.stringify(patch.output),approval:patch.approval,approval_identity:patch.approvalIdentity===undefined?undefined:JSON.stringify(patch.approvalIdentity),error:patch.error};const entries=Object.entries(fields).filter(([,value])=>value!==undefined),set=entries.map(([name],index)=>`${name}=$${index+2}${['validated_input','output','approval_identity'].includes(name)?'::jsonb':''}`).join(',');return {entries,set}}
function effectFrom(row:EffectRow|undefined):EffectReceipt{if(!row)throw new Error('Effect receipt disappeared during claim');return {key:row.key,tenantId:row.tenant_id,tool:row.tool,status:row.status,output:row.output,error:row.error,createdAt:millis(row.created_at),updatedAt:millis(row.updated_at)}}
