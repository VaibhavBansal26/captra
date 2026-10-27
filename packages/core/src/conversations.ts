import type { ExecutionIdentity } from './core.js'
import type { ChatMessage } from './chat.js'

export type ConversationStatus='active'|'archived'
export type Conversation={id:string;tenantId:string;userId:string;status:ConversationStatus;createdAt:number;updatedAt:number;archivedAt?:number}
export type ConversationMessage=ChatMessage&{id:string;conversationId:string;tenantId:string;userId:string;createdAt:number}
export type ConversationPage={items:ConversationMessage[];nextCursor?:string}
export interface ConversationStore{
  append(conversationId:string,identity:ExecutionIdentity,messages:readonly ChatMessage[]):Promise<ConversationMessage[]>
  list(conversationId:string,identity:ExecutionIdentity,options?:{cursor?:string;limit?:number}):Promise<ConversationPage>
  get(conversationId:string,identity:ExecutionIdentity):Promise<Conversation|undefined>
  archive(conversationId:string,identity:ExecutionIdentity):Promise<Conversation>
  restore(conversationId:string,identity:ExecutionIdentity):Promise<Conversation>
  delete(conversationId:string,identity:ExecutionIdentity):Promise<boolean>
}

export class InMemoryConversationStore implements ConversationStore{
  readonly #messages=new Map<string,ConversationMessage[]>()
  readonly #conversations=new Map<string,Conversation>()

  async append(conversationId:string,identity:ExecutionIdentity,messages:readonly ChatMessage[]){
    if(!messages.length)return []
    const key=scope(identity.tenantId,conversationId),conversation=this.#conversations.get(key),now=Date.now()
    if(conversation&&conversation.userId!==identity.userId)throw new Error('Conversation not found')
    if(conversation?.status==='archived')throw new Error('Conversation is archived')
    if(!conversation)this.#conversations.set(key,{id:conversationId,tenantId:identity.tenantId,userId:identity.userId,status:'active',createdAt:now,updatedAt:now})
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

  async get(conversationId:string,identity:ExecutionIdentity){
    const conversation=this.#conversations.get(scope(identity.tenantId,conversationId))
    if(conversation&&conversation.userId!==identity.userId)throw new Error('Conversation not found')
    return conversation?structuredClone(conversation):undefined
  }

  async archive(conversationId:string,identity:ExecutionIdentity){return this.#transition(conversationId,identity,'archived')}
  async restore(conversationId:string,identity:ExecutionIdentity){return this.#transition(conversationId,identity,'active')}
  async delete(conversationId:string,identity:ExecutionIdentity){
    const conversation=await this.get(conversationId,identity)
    if(!conversation)return false
    const key=scope(identity.tenantId,conversationId);this.#messages.delete(key);return this.#conversations.delete(key)
  }

  async #transition(conversationId:string,identity:ExecutionIdentity,status:ConversationStatus){
    const conversation=await this.get(conversationId,identity)
    if(!conversation)throw new Error('Conversation not found')
    const now=Date.now(),updated={...conversation,status,updatedAt:now,archivedAt:status==='archived'?now:undefined}
    this.#conversations.set(scope(identity.tenantId,conversationId),updated)
    return structuredClone(updated)
  }
}

function scope(tenantId:string,conversationId:string){return `${tenantId}:${conversationId}`}
