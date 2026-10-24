import type { ExecutionIdentity } from './core'
export const CAPTRA_PROTOCOL_VERSION = '1.0'
export type RunStatus = 'created' | 'queued' | 'running' | 'waiting_for_approval' | 'completed' | 'failed' | 'cancelled'
export type EventType = 'run.queued' | 'run.started' | 'memory.recalled' | 'hook.completed' | 'capability.started' | 'capability.retrying' | 'agent.step' | 'agent.tool.selected' | 'agent.completed' | 'checkpoint.saved' | 'checkpoint.restored' | 'tool.started' | 'tool.completed' | 'tool.failed' | 'approval.requested' | 'approval.approved' | 'approval.rejected' | 'run.completed' | 'run.failed' | 'run.cancelled'
export type CaptraEvent = { id:string; protocol:typeof CAPTRA_PROTOCOL_VERSION; runId:string; sequence:number; at:number; type:EventType; capability:string; detail:string; data?:unknown }
export type RunRecord = { id:string; app:string; appVersion:string; capability:string; status:RunStatus; identity:ExecutionIdentity; input:unknown; validatedInput?:unknown; output?:unknown; approval?:'pending'|'approved'|'rejected'; error?:string; idempotencyKey?:string; createdAt:number; updatedAt:number }
