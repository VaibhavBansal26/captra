import type { AgentApp } from './core.js'

export type Plan={capability:string;input:unknown;reason:string}
export interface PlannerAdapter { plan(prompt:string,app:AgentApp):Promise<Plan> }

export function createRulePlanner(rules:readonly {match:(prompt:string)=>boolean;capability:string;input:(prompt:string)=>unknown}[]):PlannerAdapter{
  return {async plan(prompt,app){const rule=rules.find(candidate=>candidate.match(prompt));if(!rule)throw new Error('No capability matched this request');if(!app.capabilities.some(capability=>capability.name===rule.capability))throw new Error(`Planner selected unknown capability: ${rule.capability}`);return {capability:rule.capability,input:rule.input(prompt),reason:'Matched an explicit deterministic rule'}}}
}
