import type { ZodType } from 'zod'
import { MemoryStore, type MemoryAdapter, type MemoryScope } from './memory'
import { InMemoryRunStore, type RunStore } from './stores'
import type { CaptraEvent, RunRecord } from './protocol'
import { createToolRunner, type Tool, type ToolRunner } from './tools'

export type ApprovalRequest={capability:string;summary:string;input:unknown}
export type ExecutionIdentity={tenantId:string;userId:string;projectId:string;sessionId?:string}
export type RuntimeContext=ExecutionIdentity&{runId:string;memory:MemoryAdapter;tools:ToolRunner;signal?:AbortSignal;emit:(event:Omit<CaptraEvent,'id'|'protocol'|'runId'|'sequence'|'at'>)=>Promise<void>}
export type CapabilityViewProps<Output>={value:Output;capability:string}
export type ViewReference<Output=unknown>={readonly name:string;readonly component?:unknown;readonly __output?:Output}
export function view<Output>(name:string,component?:unknown):ViewReference<Output>{return Object.freeze({name,component})}

export type Capability<Input,Output>={readonly kind:'capability';readonly name:string;readonly description:string;readonly input:ZodType<Input>;readonly output:ZodType<Output>;readonly scopes:readonly MemoryScope[];readonly permissions:readonly string[];readonly approval:'never'|'required';readonly idempotent:boolean;readonly execute:(input:Input,context:RuntimeContext)=>Promise<Output>;readonly view:ViewReference<Output>}
export function defineCapability<Input,Output>(definition:Omit<Capability<Input,Output>,'kind'|'permissions'|'idempotent'|'view'>&{permissions?:readonly string[];idempotent?:boolean;view:ViewReference<Output>|unknown}):Capability<Input,Output>{
  const candidate=definition.view as {name?:string;displayName?:string;component?:unknown}
  const resolved=candidate&&typeof candidate==='object'&&typeof candidate.name==='string'?candidate as ViewReference<Output>:view<Output>(candidate?.displayName??candidate?.name??'AnonymousView',definition.view)
  return Object.freeze({kind:'capability' as const,permissions:definition.permissions??[],idempotent:definition.idempotent??false,...definition,view:resolved})
}

export function capability<Input,Output>(definition:{name:string;description:string;input:ZodType<Input>;output:ZodType<Output>;memory?:readonly MemoryScope[];permissions?:readonly string[];approval?:'never'|'required';idempotent?:boolean;run:(input:Input,context:RuntimeContext)=>Promise<Output>;view:ViewReference<Output>|unknown}):Capability<Input,Output>{
  return defineCapability({name:definition.name,description:definition.description,input:definition.input,output:definition.output,scopes:definition.memory??[],permissions:definition.permissions,approval:definition.approval??'never',idempotent:definition.idempotent,execute:definition.run,view:definition.view})
}

export type Hook={name:string;beforeCapability?:(name:string,input:unknown,context:RuntimeContext)=>Promise<unknown>;afterCapability?:(name:string,output:unknown,context:RuntimeContext)=>Promise<unknown>}
export function defineHook(hook:Hook):Hook{return Object.freeze(hook)}
export type Surface={readonly mode:'capability-views'}
export function capabilityViews():Surface{return Object.freeze({mode:'capability-views' as const})}
export type AgentApp={name:string;version:string;scopes:readonly MemoryScope[];capabilities:readonly Capability<unknown,unknown>[];tools:readonly Tool<unknown,unknown>[];surface:Surface;hooks:readonly Hook[]}
export function defineApp<const C extends readonly Capability<any,any>[]>(definition:{name:string;version?:string;scopes:readonly MemoryScope[];capabilities:C;tools?:readonly Tool<any,any>[];surface:Surface;hooks?:readonly Hook[]}):AgentApp{
  const names=new Set<string>(); for(const capability of definition.capabilities){if(names.has(capability.name))throw new Error(`Duplicate capability: ${capability.name}`);names.add(capability.name)}
  const toolNames=new Set<string>();for(const tool of definition.tools??[]){if(toolNames.has(tool.name))throw new Error(`Duplicate tool: ${tool.name}`);toolNames.add(tool.name)}
  return Object.freeze({...definition,version:definition.version??'1.0.0',tools:definition.tools??[],hooks:definition.hooks??[]})
}

export type RunRequest={capability:string;input:unknown;identity:ExecutionIdentity;idempotencyKey?:string}
export type CapabilityResult={run:RunRecord;capability:Capability<unknown,unknown>;value:unknown;trace:CaptraEvent[]}
export type RuntimeOptions={memory?:MemoryAdapter;runs?:RunStore;authorize?:(identity:ExecutionIdentity,permissions:readonly string[])=>Promise<boolean>|boolean;signal?:AbortSignal}
export function createRuntime(app:AgentApp,options:RuntimeOptions|MemoryStore={}){
  const normalized=options instanceof MemoryStore?{memory:options}:options
  const memory=normalized.memory??new MemoryStore(),runs=normalized.runs??new InMemoryRunStore(),byName=new Map(app.capabilities.map(c=>[c.name,c]))
  const resultFor=async(run:RunRecord,capability:Capability<unknown,unknown>):Promise<CapabilityResult>=>({run,capability,value:run.output,trace:await runs.events(run.id)})
  async function continueRun(run:RunRecord,capability:Capability<unknown,unknown>):Promise<CapabilityResult>{
    const emit:RuntimeContext['emit']=async event=>{await runs.appendEvent(run.id,event)}
    const context={} as RuntimeContext
    Object.assign(context,{...run.identity,runId:run.id,memory,signal:normalized.signal,emit})
    Object.assign(context,{tools:createToolRunner(app.tools,context,async permissions=>!normalized.authorize||await normalized.authorize(run.identity,permissions))})
    try{
      await emit({type:'run.started',capability:capability.name,detail:'Validated execution started'})
      const recalled=await memory.recall(capability.scopes,context);await emit({type:'memory.recalled',capability:capability.name,detail:`${recalled.length} records`,data:{count:recalled.length}})
      let input:unknown=capability.input.parse(run.validatedInput??run.input)
      if(run.validatedInput===undefined)for(const hook of app.hooks){if(hook.beforeCapability)input=await hook.beforeCapability(capability.name,input,context);await emit({type:'hook.completed',capability:capability.name,detail:hook.name,data:{phase:'before'}})}
      if(capability.approval==='required'&&run.approval!=='approved'){await runs.update(run.id,{status:'waiting_for_approval',approval:'pending',validatedInput:input});await emit({type:'approval.requested',capability:capability.name,detail:capability.description,data:{input}});return resultFor((await runs.get(run.id))!,capability)}
      await runs.update(run.id,{status:'running',validatedInput:input});await emit({type:'capability.started',capability:capability.name,detail:'Executing capability function'})
      let output:unknown=capability.output.parse(await capability.execute(input,context));for(const hook of [...app.hooks].reverse()){if(hook.afterCapability)output=await hook.afterCapability(capability.name,output,context);await emit({type:'hook.completed',capability:capability.name,detail:hook.name,data:{phase:'after'}})}
      output=capability.output.parse(output);await runs.update(run.id,{status:'completed',output});await emit({type:'run.completed',capability:capability.name,detail:capability.view.name,data:{view:capability.view.name}});return resultFor((await runs.get(run.id))!,capability)
    }catch(error){const message=error instanceof Error?error.message:'Unknown runtime error';await runs.update(run.id,{status:'failed',error:message});await emit({type:'run.failed',capability:capability.name,detail:message});throw error}
  }
  async function execute(request:RunRequest){const capability=byName.get(request.capability);if(!capability)throw new Error(`Unknown capability: ${request.capability}`);if(normalized.authorize&&!(await normalized.authorize(request.identity,capability.permissions)))throw new Error(`Not authorized to run ${capability.name}`);if(request.idempotencyKey){const existing=await runs.findByIdempotencyKey(request.identity.tenantId,request.idempotencyKey);if(existing?.status==='completed')return resultFor(existing,capability)}const run=await runs.create({app:app.name,appVersion:app.version,capability:capability.name,input:request.input,identity:request.identity,idempotencyKey:request.idempotencyKey});return continueRun(run,capability)}
  async function approve(runId:string,decision:'approved'|'rejected'){const run=await runs.get(runId);if(!run)throw new Error(`Unknown run: ${runId}`);if(run.status!=='waiting_for_approval')throw new Error(`Run ${runId} is not waiting for approval`);const capability=byName.get(run.capability)!;await runs.update(runId,{approval:decision});await runs.appendEvent(runId,{type:decision==='approved'?'approval.approved':'approval.rejected',capability:capability.name,detail:decision});if(decision==='rejected'){await runs.update(runId,{status:'cancelled'});return resultFor((await runs.get(runId))!,capability)}return continueRun((await runs.get(runId))!,capability)}
  async function cancel(runId:string){const run=await runs.get(runId);if(!run)throw new Error(`Unknown run: ${runId}`);if(['completed','failed','cancelled'].includes(run.status))throw new Error(`Run ${runId} cannot be cancelled`);await runs.update(runId,{status:'cancelled'});await runs.appendEvent(runId,{type:'run.cancelled',capability:run.capability,detail:'Cancelled'});return runs.get(runId)}
  return {app,memory,runs,execute,approve,cancel,async run(name:string,input:unknown,legacy:Omit<ExecutionIdentity,'tenantId'>&{tenantId?:string;approve:(request:ApprovalRequest)=>Promise<boolean>}){let result=await execute({capability:name,input,identity:{tenantId:legacy.tenantId??'default',userId:legacy.userId,projectId:legacy.projectId}});if(result.run.status==='waiting_for_approval'){const allowed=await legacy.approve({capability:name,summary:result.capability.description,input});result=await approve(result.run.id,allowed?'approved':'rejected');if(!allowed)throw new Error('Approval rejected')}return result}}
}
export type Runtime=ReturnType<typeof createRuntime>
export type RuntimeEvent=CaptraEvent
