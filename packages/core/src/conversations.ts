import type { ExecutionIdentity } from './core.js'
import type { ChatMessage } from './chat.js'

export type ConversationStatus='active'|'archived'
export type ConversationRole='owner'|'editor'|'viewer'
export type Conversation={id:string;tenantId:string;userId:string;status:ConversationStatus;title?:string;labels:readonly string[];access:ConversationRole;createdAt:number;updatedAt:number;archivedAt?:number}
export type ConversationMember={userId:string;role:Exclude<ConversationRole,'owner'>;createdAt:number}
export type ConversationMessage=ChatMessage&{id:string;conversationId:string;tenantId:string;userId:string;createdAt:number}
export type ConversationPage={items:ConversationMessage[];nextCursor?:string}
export type ConversationListPage={items:Conversation[];nextCursor?:string}
export type ConversationSummary={id:string;conversationId:string;tenantId:string;content:string;sourceMessageIds:readonly string[];model:string;promptVersion:string;createdAt:number}
export type ConversationContext={summary?:ConversationSummary;messages:ConversationMessage[]}
export type ConversationSummaryInput={id?:string;content:string;sourceMessageIds:readonly string[];model:string;promptVersion:string;createdAt?:number}
export interface ConversationStore{
  append(conversationId:string,identity:ExecutionIdentity,messages:readonly ChatMessage[]):Promise<ConversationMessage[]>
  list(conversationId:string,identity:ExecutionIdentity,options?:{cursor?:string;limit?:number}):Promise<ConversationPage>
  listConversations(identity:ExecutionIdentity,options?:{cursor?:string;limit?:number;status?:ConversationStatus}):Promise<ConversationListPage>
  get(conversationId:string,identity:ExecutionIdentity):Promise<Conversation|undefined>
  context(conversationId:string,identity:ExecutionIdentity,options?:{limit?:number}):Promise<ConversationContext>
  summaries(conversationId:string,identity:ExecutionIdentity):Promise<ConversationSummary[]>
  saveSummary(conversationId:string,identity:ExecutionIdentity,input:ConversationSummaryInput):Promise<ConversationSummary>
  update(conversationId:string,identity:ExecutionIdentity,patch:{title?:string|null;labels?:readonly string[]}):Promise<Conversation>
  archive(conversationId:string,identity:ExecutionIdentity):Promise<Conversation>
  restore(conversationId:string,identity:ExecutionIdentity):Promise<Conversation>
  members(conversationId:string,identity:ExecutionIdentity):Promise<ConversationMember[]>
  share(conversationId:string,identity:ExecutionIdentity,userId:string,role:Exclude<ConversationRole,'owner'>):Promise<ConversationMember>
  unshare(conversationId:string,identity:ExecutionIdentity,userId:string):Promise<boolean>
  transfer(conversationId:string,identity:ExecutionIdentity,newOwnerId:string):Promise<Conversation>
  delete(conversationId:string,identity:ExecutionIdentity):Promise<boolean>
}

export class InMemoryConversationStore implements ConversationStore{
  readonly #messages=new Map<string,ConversationMessage[]>()
  readonly #conversations=new Map<string,Conversation>()
  readonly #members=new Map<string,Map<string,ConversationMember>>()
  readonly #summaries=new Map<string,ConversationSummary[]>()

  async append(conversationId:string,identity:ExecutionIdentity,messages:readonly ChatMessage[]){
    if(!messages.length)return []
    const key=scope(identity.tenantId,conversationId),conversation=this.#conversations.get(key),now=Date.now()
    if(conversation&&!this.#canWrite(key,identity.userId))throw new Error('Conversation not found')
    if(conversation?.status==='archived')throw new Error('Conversation is archived')
    if(!conversation)this.#conversations.set(key,{id:conversationId,tenantId:identity.tenantId,userId:identity.userId,status:'active',labels:[],access:'owner',createdAt:now,updatedAt:now})
    const current=this.#messages.get(key)??[],ids=new Set(current.map(message=>message.id)),created:ConversationMessage[]=[]
    for(const message of messages){
      const id=message.id??crypto.randomUUID()
      if(ids.has(id))continue
      const saved={...message,id,conversationId,tenantId:identity.tenantId,userId:identity.userId,createdAt:now+created.length}
      current.push(saved);created.push(saved);ids.add(id)
    }
    this.#messages.set(key,current)
    this.#conversations.get(key)!.updatedAt=Date.now()
    return structuredClone(created)
  }

  async list(conversationId:string,identity:ExecutionIdentity,options:{cursor?:string;limit?:number}={}){
    const conversation=await this.get(conversationId,identity)
    if(!conversation)return {items:[]}
    const all=this.#messages.get(scope(identity.tenantId,conversationId))??[],limit=Math.max(1,Math.min(100,options.limit??30)),before=options.cursor?all.findIndex(message=>message.id===options.cursor):all.length,end=before<0?all.length:before,start=Math.max(0,end-limit),items=all.slice(start,end),nextCursor=start>0?items[0]?.id:undefined
    return structuredClone({items,nextCursor})
  }

  async listConversations(identity:ExecutionIdentity,options:{cursor?:string;limit?:number;status?:ConversationStatus}={}){
    const visible=[...this.#conversations.entries()].filter(([,item])=>item.tenantId===identity.tenantId&&(item.userId===identity.userId||this.#members.get(scope(item.tenantId,item.id))?.has(identity.userId))&&(!options.status||item.status===options.status)).sort(([,left],[,right])=>right.updatedAt-left.updatedAt||left.id.localeCompare(right.id)),start=options.cursor?Math.max(0,visible.findIndex(([,item])=>item.id===options.cursor)+1):0,limit=Math.max(1,Math.min(100,options.limit??30)),selected=visible.slice(start,start+limit),items=selected.map(([key,item])=>this.#withAccess(key,item,identity.userId))
    return structuredClone({items,nextCursor:start+limit<visible.length?items.at(-1)?.id:undefined})
  }

  async context(conversationId:string,identity:ExecutionIdentity,options:{limit?:number}={}){
    await this.get(conversationId,identity);const key=scope(identity.tenantId,conversationId),all=this.#messages.get(key)??[],summary=this.#summaries.get(key)?.at(-1),through=summary?all.findIndex(item=>item.id===summary.sourceMessageIds.at(-1)):-1,limit=Math.max(1,Math.min(100,options.limit??30)),messages=all.slice(Math.max(through+1,all.length-limit))
    return structuredClone({summary,messages})
  }
  async summaries(conversationId:string,identity:ExecutionIdentity){await this.get(conversationId,identity);return structuredClone(this.#summaries.get(scope(identity.tenantId,conversationId))??[])}
  async saveSummary(conversationId:string,identity:ExecutionIdentity,input:ConversationSummaryInput){const key=scope(identity.tenantId,conversationId);await this.get(conversationId,identity);if(!this.#canWrite(key,identity.userId))throw new Error('Conversation not found');if(!input.content||!input.sourceMessageIds.length||!input.model||!input.promptVersion)throw new Error('Invalid conversation summary');const ids=new Set((this.#messages.get(key)??[]).map(item=>item.id));if(input.sourceMessageIds.some(id=>!ids.has(id)))throw new Error('Invalid conversation summary sources');const summary={id:input.id??crypto.randomUUID(),conversationId,tenantId:identity.tenantId,content:input.content,sourceMessageIds:[...input.sourceMessageIds],model:input.model,promptVersion:input.promptVersion,createdAt:input.createdAt??Date.now()};const values=this.#summaries.get(key)??[];if(!values.some(item=>item.id===summary.id))values.push(summary);this.#summaries.set(key,values);return structuredClone(summary)}

  async get(conversationId:string,identity:ExecutionIdentity){
    const conversation=this.#conversations.get(scope(identity.tenantId,conversationId))
    if(conversation&&conversation.userId!==identity.userId&&!this.#members.get(scope(identity.tenantId,conversationId))?.has(identity.userId))throw new Error('Conversation not found')
    return conversation?structuredClone(this.#withAccess(scope(identity.tenantId,conversationId),conversation,identity.userId)):undefined
  }

  async update(conversationId:string,identity:ExecutionIdentity,patch:{title?:string|null;labels?:readonly string[]}){
    const key=scope(identity.tenantId,conversationId),conversation=await this.get(conversationId,identity)
    if(!conversation||!this.#canWrite(key,identity.userId))throw new Error('Conversation not found')
    const updated={...conversation,title:patch.title===null?undefined:patch.title??conversation.title,labels:patch.labels?[...new Set(patch.labels)]:conversation.labels,updatedAt:Date.now()};this.#conversations.set(key,{...updated,access:'owner'});return structuredClone(this.#withAccess(key,updated,identity.userId))
  }

  async archive(conversationId:string,identity:ExecutionIdentity){return this.#transition(conversationId,identity,'archived')}
  async restore(conversationId:string,identity:ExecutionIdentity){return this.#transition(conversationId,identity,'active')}
  async members(conversationId:string,identity:ExecutionIdentity){const key=scope(identity.tenantId,conversationId);this.#owner(await this.get(conversationId,identity),identity);return structuredClone([...(this.#members.get(key)?.values()??[])])}
  async share(conversationId:string,identity:ExecutionIdentity,userId:string,role:Exclude<ConversationRole,'owner'>){const key=scope(identity.tenantId,conversationId),conversation=await this.get(conversationId,identity);this.#owner(conversation,identity);if(!userId||userId===identity.userId)throw new Error('Invalid conversation member');const member={userId,role,createdAt:Date.now()};const members=this.#members.get(key)??new Map();members.set(userId,member);this.#members.set(key,members);return structuredClone(member)}
  async unshare(conversationId:string,identity:ExecutionIdentity,userId:string){const key=scope(identity.tenantId,conversationId);this.#owner(await this.get(conversationId,identity),identity);return this.#members.get(key)?.delete(userId)??false}
  async transfer(conversationId:string,identity:ExecutionIdentity,newOwnerId:string){const key=scope(identity.tenantId,conversationId),conversation=await this.get(conversationId,identity);this.#owner(conversation,identity);if(!newOwnerId||newOwnerId===identity.userId)throw new Error('Invalid conversation owner');const members=this.#members.get(key)??new Map();members.delete(newOwnerId);members.set(identity.userId,{userId:identity.userId,role:'editor',createdAt:Date.now()});this.#members.set(key,members);const updated={...conversation!,userId:newOwnerId,access:'owner' as const,updatedAt:Date.now()};this.#conversations.set(key,updated);return structuredClone({...updated,access:'editor' as const})}
  async delete(conversationId:string,identity:ExecutionIdentity){
    const conversation=await this.get(conversationId,identity)
    if(!conversation)return false
    this.#owner(conversation,identity);const key=scope(identity.tenantId,conversationId);this.#messages.delete(key);this.#members.delete(key);this.#summaries.delete(key);return this.#conversations.delete(key)
  }

  async #transition(conversationId:string,identity:ExecutionIdentity,status:ConversationStatus){
    const conversation=await this.get(conversationId,identity)
    this.#owner(conversation,identity)
    const now=Date.now(),updated={...conversation,status,updatedAt:now,archivedAt:status==='archived'?now:undefined}
    this.#conversations.set(scope(identity.tenantId,conversationId),updated)
    return structuredClone(updated)
  }
  #owner(conversation:Conversation|undefined,identity:ExecutionIdentity):asserts conversation is Conversation{if(!conversation||conversation.userId!==identity.userId)throw new Error('Conversation not found')}
  #canWrite(key:string,userId:string){const conversation=this.#conversations.get(key);return conversation?.userId===userId||this.#members.get(key)?.get(userId)?.role==='editor'}
  #withAccess(key:string,conversation:Conversation,userId:string):Conversation{return {...conversation,access:conversation.userId===userId?'owner':this.#members.get(key)?.get(userId)?.role??'viewer'}}
}

function scope(tenantId:string,conversationId:string){return `${tenantId}:${conversationId}`}
