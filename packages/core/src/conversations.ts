import type { ExecutionIdentity } from './core.js'
import type { ChatMessage } from './chat.js'

export type ConversationMessage=ChatMessage&{id:string;conversationId:string;tenantId:string;userId:string;createdAt:number}
export type ConversationPage={items:ConversationMessage[];nextCursor?:string}
export interface ConversationStore{
  append(conversationId:string,identity:ExecutionIdentity,messages:readonly ChatMessage[]):Promise<ConversationMessage[]>
  list(conversationId:string,identity:ExecutionIdentity,options?:{cursor?:string;limit?:number}):Promise<ConversationPage>
}

export class InMemoryConversationStore implements ConversationStore{
  readonly #messages=new Map<string,ConversationMessage[]>()
  async append(conversationId:string,identity:ExecutionIdentity,messages:readonly ChatMessage[]){const key=scope(identity.tenantId,conversationId),current=this.#messages.get(key)??[];if(current.length&&current[0].userId!==identity.userId)throw new Error('Conversation not found');const ids=new Set(current.map(message=>message.id)),created:ConversationMessage[]=[];for(const message of messages){const id=message.id??crypto.randomUUID();if(ids.has(id))continue;const saved={...message,id,conversationId,tenantId:identity.tenantId,userId:identity.userId,createdAt:Date.now()+created.length};current.push(saved);created.push(saved);ids.add(id)}this.#messages.set(key,current);return structuredClone(created)}
  async list(conversationId:string,identity:ExecutionIdentity,options:{cursor?:string;limit?:number}={}){const all=this.#messages.get(scope(identity.tenantId,conversationId))??[];if(all.length&&all[0].userId!==identity.userId)throw new Error('Conversation not found');const limit=Math.max(1,Math.min(100,options.limit??30)),before=options.cursor?all.findIndex(message=>message.id===options.cursor):all.length,end=before<0?all.length:before,start=Math.max(0,end-limit),items=all.slice(start,end),nextCursor=start>0?items[0]?.id:undefined;return structuredClone({items,nextCursor})}
}

function scope(tenantId:string,conversationId:string){return `${tenantId}:${conversationId}`}
