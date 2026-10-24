import type { ZodType } from 'zod'
import { MemoryStore, type MemoryAdapter, type MemoryRecord, type MemoryScope } from './memory.js'
import { InMemoryRunStore, type RunStore } from './stores.js'
import type { CaptraEvent, RunRecord } from './protocol.js'
import { createToolRunner, type Tool, type ToolRunner } from './tools.js'
import type { WorkQueue } from './queue.js'
import { InMemoryCheckpointStore,type CheckpointStore,type RunCheckpoints } from './checkpoints.js'
import { noopTelemetry,type TelemetryAdapter } from './telemetry.js'
import { InMemoryBudgetAdapter,type BudgetAdapter } from './budgets.js'
import { InMemoryEffectStore,type EffectStore } from './effects.js'

export type ApprovalRequest={capability:string;summary:string;input:unknown}
export type ExecutionIdentity={tenantId:string;userId:string;projectId:string;sessionId?:string}
export type ApprovalPolicy='never'|'required'|{required:true;allowRequester?:boolean}
export class RunCancelledError extends Error{readonly code='run_cancelled';constructor(readonly runId:string){super(`Run ${runId} was cancelled`);this.name='RunCancelledError'}}
export type RuntimeContext=ExecutionIdentity&{runId:string;memory:MemoryAdapter;memories:readonly MemoryRecord[];tools:ToolRunner;checkpoints:RunCheckpoints;budgets:BudgetAdapter;effects:EffectStore;telemetry:TelemetryAdapter;signal:AbortSignal;emit:(event:Omit<CaptraEvent,'id'|'protocol'|'runId'|'sequence'|'at'>)=>Promise<void>}
export type CapabilityViewProps<Output>={value:Output;capability:string}
export type ViewReference<Output=unknown>={readonly name:string;readonly component?:unknown;readonly __output?:Output}
export function view<Output>(name:string,component?:unknown):ViewReference<Output>{return Object.freeze({name,component})}

export type ExecutionPolicy={timeoutMs?:number;retries?:number;retryDelayMs?:number}
export type StateReference=string|readonly unknown[]
export type CapabilityState={readonly reads:readonly StateReference[];readonly writes:readonly StateReference[];readonly invalidates:readonly StateReference[];readonly locks:readonly StateReference[]}
export type Capability<Input,Output,Name extends string=string>={readonly kind:'capability';readonly mode:'function'|'agent';readonly name:Name;readonly description:string;readonly input:ZodType<Input>;readonly output:ZodType<Output>;readonly scopes:readonly MemoryScope[];readonly state:CapabilityState;readonly permissions:readonly string[];readonly approval:ApprovalPolicy;readonly idempotent:boolean;readonly policy:ExecutionPolicy;readonly tools:readonly Tool<any,any>[];readonly execute:(input:Input,context:RuntimeContext)=>Promise<Output>;readonly view:ViewReference<Output>}
export function defineCapability<const Name extends string,Input,Output>(definition:Omit<Capability<Input,Output,Name>,'kind'|'mode'|'permissions'|'idempotent'|'policy'|'tools'|'view'|'state'>&{mode?:'function'|'agent';state?:Partial<CapabilityState>;permissions?:readonly string[];idempotent?:boolean;policy?:ExecutionPolicy;tools?:readonly Tool<any,any>[];view:ViewReference<Output>|unknown}):Capability<Input,Output,Name>{
  const candidate=definition.view as {name?:string;displayName?:string;component?:unknown}
  const resolved=candidate&&typeof candidate==='object'&&typeof candidate.name==='string'?candidate as ViewReference<Output>:view<Output>(candidate?.displayName??candidate?.name??'AnonymousView',definition.view)
  return Object.freeze({...definition,kind:'capability' as const,mode:definition.mode??'function',state:Object.freeze({reads:Object.freeze([...(definition.state?.reads??[])]),writes:Object.freeze([...(definition.state?.writes??[])]),invalidates:Object.freeze([...(definition.state?.invalidates??[])]),locks:Object.freeze([...(definition.state?.locks??[])])}),permissions:definition.permissions??[],idempotent:definition.idempotent??false,policy:definition.policy??{},tools:definition.tools??[],view:resolved})
}

export function capability<const Name extends string,Input,Output>(definition:{name:Name;description:string;input:ZodType<Input>;output:ZodType<Output>;memory?:readonly MemoryScope[];state?:Partial<CapabilityState>;permissions?:readonly string[];approval?:ApprovalPolicy;idempotent?:boolean;policy?:ExecutionPolicy;tools?:readonly Tool<any,any>[];mode?:'function'|'agent';run:(input:Input,context:RuntimeContext)=>Promise<Output>;view:ViewReference<Output>|unknown}):Capability<Input,Output,Name>{
  return defineCapability({name:definition.name,description:definition.description,input:definition.input,output:definition.output,scopes:definition.memory??[],state:definition.state,permissions:definition.permissions,approval:definition.approval??'never',idempotent:definition.idempotent,policy:definition.policy,tools:definition.tools,mode:definition.mode,execute:definition.run,view:definition.view})
}

export type Hook={
  name:string
  beforeCapability?:(name:string,input:unknown,context:RuntimeContext)=>unknown|Promise<unknown>
  afterCapability?:(name:string,output:unknown,context:RuntimeContext)=>unknown|Promise<unknown>
  afterMemoryRecall?:(records:readonly MemoryRecord[],context:RuntimeContext)=>readonly MemoryRecord[]|Promise<readonly MemoryRecord[]>
  beforeTool?:(name:string,input:unknown,context:RuntimeContext)=>unknown|Promise<unknown>
  afterTool?:(name:string,output:unknown,context:RuntimeContext)=>unknown|Promise<unknown>
  beforeApproval?:(approval:{run:RunRecord;decision:'approved'|'rejected';approver:ExecutionIdentity})=>void|Promise<void>
  onEvent?:(event:CaptraEvent,context:RuntimeContext)=>void|Promise<void>
  onError?:(name:string,error:unknown,context:RuntimeContext)=>void|Promise<void>
  onToolError?:(name:string,error:unknown,context:RuntimeContext)=>void|Promise<void>
}
export function defineHook(hook:Hook):Hook{return Object.freeze(hook)}
export type CaptraPlugin={readonly name:string;readonly version:string;readonly tools:readonly Tool<any,any>[];readonly hooks:readonly Hook[]}
export function definePlugin(definition:{name:string;version?:string;tools?:readonly Tool<any,any>[];hooks?:readonly Hook[]}):CaptraPlugin{
  if(!definition.name.trim())throw new Error('Plugin name is required')
  return Object.freeze({name:definition.name,version:definition.version??'1.0.0',tools:Object.freeze([...(definition.tools??[])]),hooks:Object.freeze([...(definition.hooks??[])])})
}
export type Surface={readonly mode:'capability-views'}
export function capabilityViews():Surface{return Object.freeze({mode:'capability-views' as const})}
export type AgentApp<C extends readonly Capability<any,any,any>[]=readonly Capability<any,any,any>[] >={name:string;version:string;scopes:readonly MemoryScope[];capabilities:C;tools:readonly Tool<unknown,unknown>[];surface:Surface;hooks:readonly Hook[];plugins:readonly CaptraPlugin[]}
export type CapabilityName<App extends AgentApp>=App['capabilities'][number]['name']
export type CapabilityByName<App extends AgentApp,Name extends CapabilityName<App>>=Extract<App['capabilities'][number],{name:Name}>
export type CapabilityInput<App extends AgentApp,Name extends CapabilityName<App>>=CapabilityByName<App,Name> extends Capability<infer Input,any,any>?Input:never
export type CapabilityOutput<App extends AgentApp,Name extends CapabilityName<App>>=CapabilityByName<App,Name> extends Capability<any,infer Output,any>?Output:never
export function defineApp<const C extends readonly Capability<any,any,any>[]>(definition:{name:string;version?:string;scopes:readonly MemoryScope[];capabilities:C;tools?:readonly Tool<any,any>[];surface:Surface;hooks?:readonly Hook[];plugins?:readonly CaptraPlugin[]}):AgentApp<C>{
  const names=new Set<string>(); for(const capability of definition.capabilities){if(names.has(capability.name))throw new Error(`Duplicate capability: ${capability.name}`);names.add(capability.name)}
  const plugins=definition.plugins??[],pluginNames=new Set<string>();for(const plugin of plugins){if(pluginNames.has(plugin.name))throw new Error(`Duplicate plugin: ${plugin.name}`);pluginNames.add(plugin.name)}
  const toolRegistry=new Map<string,Tool<any,any>>();for(const tool of [...plugins.flatMap(plugin=>plugin.tools),...definition.capabilities.flatMap(capability=>capability.tools),...(definition.tools??[])]){const existing=toolRegistry.get(tool.name);if(existing&&existing!==tool)throw new Error(`Duplicate tool: ${tool.name}`);toolRegistry.set(tool.name,tool)}
  return Object.freeze({...definition,version:definition.version??'1.0.0',plugins:Object.freeze([...plugins]),tools:Object.freeze([...toolRegistry.values()]),hooks:Object.freeze([...plugins.flatMap(plugin=>plugin.hooks),...(definition.hooks??[])])})
}

export type RunRequest={capability:string;input:unknown;identity:ExecutionIdentity;idempotencyKey?:string;onEvent?:(event:CaptraEvent)=>void|Promise<void>}
export type CapabilityResult={run:RunRecord;capability:Capability<unknown,unknown>;value:unknown;trace:CaptraEvent[]}
export type RuntimeOptions={memory?:MemoryAdapter;runs?:RunStore;checkpoints?:CheckpointStore;budgets?:BudgetAdapter;effects?:EffectStore;telemetry?:TelemetryAdapter;authorize?:(identity:ExecutionIdentity,permissions:readonly string[])=>Promise<boolean>|boolean;authorizeApproval?:(approver:ExecutionIdentity,run:RunRecord)=>Promise<boolean>|boolean;signal?:AbortSignal}
export function createRuntime(app:AgentApp,options:RuntimeOptions|MemoryStore={}){
  const normalized=options instanceof MemoryStore?{memory:options}:options
  const memory=normalized.memory??new MemoryStore(),runs=normalized.runs??new InMemoryRunStore(),checkpoints=normalized.checkpoints??new InMemoryCheckpointStore(),budgets=normalized.budgets??new InMemoryBudgetAdapter(),effects=normalized.effects??new InMemoryEffectStore(),telemetry=normalized.telemetry??noopTelemetry,byName=new Map(app.capabilities.map(c=>[c.name,c])),activeRuns=new Map<string,AbortController>()
  const resultFor=async(run:RunRecord,capability:Capability<unknown,unknown>):Promise<CapabilityResult>=>({run,capability,value:run.output,trace:await runs.events(run.id)})
  async function continueRun(run:RunRecord,capability:Capability<unknown,unknown>):Promise<CapabilityResult>{
    const controller=new AbortController();activeRuns.set(run.id,controller);if(normalized.signal?.aborted)controller.abort(normalized.signal.reason);else normalized.signal?.addEventListener('abort',()=>controller.abort(normalized.signal?.reason),{once:true})
    const span=telemetry.startSpan('captra.run',{runId:run.id,capability:capability.name,tenantId:run.identity.tenantId,mode:capability.mode}),startedAt=Date.now()
    const context={} as RuntimeContext
    const observe=async(callback:()=>void|Promise<void>)=>{try{await callback()}catch{telemetry.counter?.('captra.hook.failures',1,{capability:capability.name})}}
    const emit:RuntimeContext['emit']=async event=>{const saved=await runs.appendEvent(run.id,event);await runRequestEvents.get(run.id)?.(saved);for(const hook of app.hooks)if(hook.onEvent)await observe(()=>hook.onEvent!(saved,context))}
    const scopedCheckpoints:RunCheckpoints={save:async(key,state)=>{const saved=await checkpoints.save(run.id,key,state);await emit({type:'checkpoint.saved',capability:capability.name,detail:key,data:{sequence:saved.sequence}});return saved},load:async key=>{const saved=await checkpoints.load(run.id,key);if(saved)await emit({type:'checkpoint.restored',capability:capability.name,detail:key,data:{sequence:saved.sequence}});return saved},list:()=>checkpoints.list(run.id)}
    Object.assign(context,{...run.identity,runId:run.id,memory,memories:[],checkpoints:scopedCheckpoints,budgets,effects,telemetry,signal:controller.signal,emit})
    Object.assign(context,{tools:createToolRunner(app.tools,context,async permissions=>!normalized.authorize||await normalized.authorize(run.identity,permissions),{
      before:async(name,input)=>{let value=input;for(const hook of app.hooks)if(hook.beforeTool)value=await hook.beforeTool(name,value,context);return value},
      after:async(name,output)=>{let value=output;for(const hook of [...app.hooks].reverse())if(hook.afterTool)value=await hook.afterTool(name,value,context);return value},
      error:async(name,error)=>{for(const hook of [...app.hooks].reverse())if(hook.onToolError)await observe(()=>hook.onToolError!(name,error,context))},
    })})
    try{
      await emit({type:'run.started',capability:capability.name,detail:'Validated execution started'})
      let input:unknown=capability.input.parse(run.validatedInput??run.input)
      let recalled=await memory.recall(capability.scopes,context,{query:safeQuery(input),limit:20});for(const hook of app.hooks)if(hook.afterMemoryRecall)recalled=[...await hook.afterMemoryRecall(recalled,context)];Object.assign(context,{memories:recalled});await emit({type:'memory.recalled',capability:capability.name,detail:`${recalled.length} records`,data:{count:recalled.length}})
      if(run.validatedInput===undefined)for(const hook of app.hooks)if(hook.beforeCapability){input=await hook.beforeCapability(capability.name,input,context);await emit({type:'hook.completed',capability:capability.name,detail:hook.name,data:{phase:'before'}})}
      if(requiresApproval(capability.approval)&&run.approval!=='approved'){const waiting=await runs.compareAndSet(run.id,[run.status],{status:'waiting_for_approval',approval:'pending',validatedInput:input});if(!waiting)throw new RunCancelledError(run.id);await emit({type:'approval.requested',capability:capability.name,detail:capability.description,data:{input,requester:run.identity}});activeRuns.delete(run.id);span.setAttribute('status','waiting_for_approval');span.end();telemetry.histogram?.('captra.run.duration',Date.now()-startedAt,{capability:capability.name,status:'waiting_for_approval'});return resultFor(waiting,capability)}
      const running=await runs.compareAndSet(run.id,[run.status],{status:'running',validatedInput:input});if(!running)throw new RunCancelledError(run.id);await emit({type:'capability.started',capability:capability.name,detail:'Executing capability function'})
      let output:unknown=capability.output.parse(await executeWithPolicy(capability,input,context));for(const hook of [...app.hooks].reverse())if(hook.afterCapability){output=await hook.afterCapability(capability.name,output,context);await emit({type:'hook.completed',capability:capability.name,detail:hook.name,data:{phase:'after'}})}
      output=capability.output.parse(output);const completed=await runs.compareAndSet(run.id,['running'],{status:'completed',output});if(!completed)throw new RunCancelledError(run.id);await emit({type:'run.completed',capability:capability.name,detail:capability.view.name,data:{view:capability.view.name}});activeRuns.delete(run.id);span.setAttribute('status','completed');span.end();telemetry.histogram?.('captra.run.duration',Date.now()-startedAt,{capability:capability.name,status:'completed'});return resultFor(completed,capability)
    }catch(error){activeRuns.delete(run.id);const current=await runs.get(run.id);if(current?.status==='cancelled'||controller.signal.aborted){span.setAttribute('status','cancelled');span.end(error);throw error instanceof RunCancelledError?error:new RunCancelledError(run.id)}for(const hook of [...app.hooks].reverse())if(hook.onError)await observe(()=>hook.onError!(capability.name,error,context));const message=error instanceof Error?error.message:'Unknown runtime error',failed=await runs.compareAndSet(run.id,['created','queued','running'],{status:'failed',error:message});if(failed)await emit({type:'run.failed',capability:capability.name,detail:message});span.setAttribute('status','failed');span.end(error);telemetry.counter?.('captra.run.failures',1,{capability:capability.name});telemetry.histogram?.('captra.run.duration',Date.now()-startedAt,{capability:capability.name,status:'failed'});throw error}
  }
  const runRequestEvents=new Map<string,RunRequest['onEvent']>()
  async function execute(request:RunRequest){const capability=byName.get(request.capability);if(!capability)throw new Error(`Unknown capability: ${request.capability}`);if(normalized.authorize&&!(await normalized.authorize(request.identity,capability.permissions)))throw new Error(`Not authorized to run ${capability.name}`);if(request.idempotencyKey){const existing=await runs.findByIdempotencyKey(request.identity.tenantId,request.idempotencyKey);if(existing)return resultFor(existing,capability)}const run=await runs.create({app:app.name,appVersion:app.version,capability:capability.name,input:request.input,identity:request.identity,idempotencyKey:request.idempotencyKey});if(run.status!=='created')return resultFor(run,capability);if(request.onEvent)runRequestEvents.set(run.id,request.onEvent);try{return await continueRun(run,capability)}finally{runRequestEvents.delete(run.id)}}
  async function approve(runId:string,decision:'approved'|'rejected',approver:ExecutionIdentity){const run=await runs.get(runId);if(!run)throw new Error(`Unknown run: ${runId}`);if(run.status!=='waiting_for_approval')throw new Error(`Run ${runId} is not waiting for approval`);if(run.identity.tenantId!==approver.tenantId)throw new Error('Approver must belong to the run tenant');const capability=byName.get(run.capability)!;if(decision==='approved'&&!allowsRequester(capability.approval)&&sameActor(run.identity,approver))throw new Error('Requester cannot approve their own run');if(normalized.authorizeApproval&&!(await normalized.authorizeApproval(approver,run)))throw new Error('Not authorized to approve this run');for(const hook of app.hooks)await hook.beforeApproval?.({run,decision,approver});const decided=await runs.compareAndSet(runId,['waiting_for_approval'],{status:decision==='approved'?'running':'cancelled',approval:decision,approvalIdentity:approver});if(!decided)throw new Error(`Run ${runId} is no longer waiting for approval`);await runs.appendEvent(runId,{type:decision==='approved'?'approval.approved':'approval.rejected',capability:capability.name,detail:decision,data:{approver}});if(decision==='rejected')return resultFor(decided,capability);return continueRun(decided,capability)}
  async function enqueue(request:RunRequest,queue:WorkQueue,options:{maxAttempts?:number;availableAt?:number}={}){const capability=byName.get(request.capability);if(!capability)throw new Error(`Unknown capability: ${request.capability}`);if(normalized.authorize&&!(await normalized.authorize(request.identity,capability.permissions)))throw new Error(`Not authorized to run ${capability.name}`);if(request.idempotencyKey){const existing=await runs.findByIdempotencyKey(request.identity.tenantId,request.idempotencyKey);if(existing)return existing}capability.input.parse(request.input);const run=await runs.create({app:app.name,appVersion:app.version,capability:capability.name,input:request.input,identity:request.identity,idempotencyKey:request.idempotencyKey});if(run.status!=='created')return run;await runs.update(run.id,{status:'queued'});await runs.appendEvent(run.id,{type:'run.queued',capability:capability.name,detail:'Queued for background execution'});try{await queue.enqueue({runId:run.id,...options})}catch(error){const message=error instanceof Error?error.message:'Queue operation failed';await runs.update(run.id,{status:'failed',error:message});await runs.appendEvent(run.id,{type:'run.failed',capability:capability.name,detail:message});throw error}return (await runs.get(run.id))!}
  async function resume(runId:string){const run=await runs.get(runId);if(!run)throw new Error(`Unknown run: ${runId}`);const capability=byName.get(run.capability);if(!capability)throw new Error(`Unknown capability: ${run.capability}`);if(['completed','cancelled','waiting_for_approval'].includes(run.status))return resultFor(run,capability);return continueRun(run,capability)}
  async function cancel(runId:string){const run=await runs.get(runId);if(!run)throw new Error(`Unknown run: ${runId}`);const cancelled=await runs.compareAndSet(runId,['created','queued','running','waiting_for_approval'],{status:'cancelled'});if(!cancelled)throw new Error(`Run ${runId} cannot be cancelled`);activeRuns.get(runId)?.abort(new RunCancelledError(runId));await runs.appendEvent(runId,{type:'run.cancelled',capability:run.capability,detail:'Cancelled'});return cancelled}
  async function replay(runId:string){const run=await runs.get(runId);if(!run)throw new Error(`Unknown run: ${runId}`);return {run,events:await runs.events(runId),checkpoints:await checkpoints.list(runId)}}
  return {app,memory,runs,checkpoints,budgets,effects,telemetry,execute,enqueue,resume,replay,approve,cancel,async run(name:string,input:unknown,legacy:Omit<ExecutionIdentity,'tenantId'>&{tenantId?:string;approver?:ExecutionIdentity;approve:(request:ApprovalRequest)=>Promise<boolean>}){let result=await execute({capability:name,input,identity:{tenantId:legacy.tenantId??'default',userId:legacy.userId,projectId:legacy.projectId}});if(result.run.status==='waiting_for_approval'){if(!legacy.approver)throw new Error('Legacy approval requires an independent approver identity');const allowed=await legacy.approve({capability:name,summary:result.capability.description,input});result=await approve(result.run.id,allowed?'approved':'rejected',legacy.approver);if(!allowed)throw new Error('Approval rejected')}return result}}
}
function requiresApproval(policy:ApprovalPolicy){return policy==='required'||typeof policy==='object'&&policy.required}
function allowsRequester(policy:ApprovalPolicy){return typeof policy==='object'&&policy.allowRequester===true}
function sameActor(left:ExecutionIdentity,right:ExecutionIdentity){return left.tenantId===right.tenantId&&left.userId===right.userId}
function safeQuery(input:unknown){const values:string[]=[];const visit=(value:unknown,depth:number)=>{if(depth>4)return;if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')values.push(String(value));else if(Array.isArray(value))value.forEach(item=>visit(item,depth+1));else if(value&&typeof value==='object')Object.values(value).forEach(item=>visit(item,depth+1))};visit(input,0);return values.join(' ')||undefined}
async function executeWithPolicy(capability:Capability<unknown,unknown>,input:unknown,context:RuntimeContext){
  const retries=capability.policy.retries??0
  for(let attempt=0;;attempt++)try{
    const operation=capability.execute(input,context)
    if(!capability.policy.timeoutMs)return await operation
    return await Promise.race([operation,new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error(`Capability timed out after ${capability.policy.timeoutMs}ms`)),capability.policy.timeoutMs))])
  }catch(error){if(attempt>=retries)throw error;await context.emit({type:'capability.retrying',capability:capability.name,detail:`Retry ${attempt+1} of ${retries}`,data:{attempt:attempt+1}});if(capability.policy.retryDelayMs)await new Promise(resolve=>setTimeout(resolve,capability.policy.retryDelayMs))}
}
export type Runtime=ReturnType<typeof createRuntime>
export type RuntimeEvent=CaptraEvent
