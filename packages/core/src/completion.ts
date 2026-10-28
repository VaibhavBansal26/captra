import type { ChatMessage } from './chat.js'
import type { ExecutionIdentity } from './core.js'
import type { CaptraEvent, RunRecord } from './protocol.js'
import type { RunStore } from './stores.js'
import type { ConversationStore } from './conversations.js'
import type { UsageInput, UsageStore } from './usage.js'

export type ConversationCompletionWrite={conversationId:string;identity:ExecutionIdentity;messages:readonly ChatMessage[]}
export type RunCompletionWrite={runId:string;capability:string;view:string;output:unknown;conversations:readonly ConversationCompletionWrite[];usage:readonly UsageInput[]}
export type RunCompletionResult={run:RunRecord;event:CaptraEvent}

/** Commits externally visible output before a run becomes terminal. Durable adapters should make this operation atomic. */
export interface RunCompletionStore{commit(write:RunCompletionWrite):Promise<RunCompletionResult>}

export interface RunCompletionBuffer{
  conversation(conversationId:string,identity:ExecutionIdentity,messages:readonly ChatMessage[]):void
  usage(record:UsageInput):void
}

export function createCompletionBuffer(){
  const conversations:ConversationCompletionWrite[]=[],usage:UsageInput[]=[]
  const buffer:RunCompletionBuffer={
    conversation:(conversationId,identity,messages)=>{if(messages.length)conversations.push({conversationId,identity,messages})},
    usage:record=>usage.push(record),
  }
  return {buffer,conversations,usage}
}

/** Portable ordered fallback. Use an atomic adapter such as PostgresRunCompletionStore in production. */
export class OrderedRunCompletionStore implements RunCompletionStore{
  constructor(readonly runs:RunStore,readonly conversations:ConversationStore,readonly usage:UsageStore){}
  async commit(write:RunCompletionWrite){
    for(const item of write.conversations)await this.conversations.append(item.conversationId,item.identity,item.messages)
    for(const item of write.usage)await this.usage.record(item)
    const run=await this.runs.compareAndSet(write.runId,['running'],{status:'completed',output:write.output})
    if(!run)throw new Error(`Run ${write.runId} is no longer running`)
    const event=await this.runs.appendEvent(write.runId,{type:'run.completed',capability:write.capability,detail:write.view,data:{view:write.view}})
    return {run,event}
  }
}
