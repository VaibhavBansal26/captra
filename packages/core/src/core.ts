import type { ZodType } from 'zod'
import { MemoryStore, type MemoryAdapter, type MemoryRecord, type MemoryScope } from './memory.js'
import { InMemoryRunStore, type RunStore } from './stores.js'
import type { CaptraEvent, RunRecord } from './protocol.js'
import { createToolRunner, type Tool, type ToolRunner } from './tools.js'
import type { WorkQueue } from './queue.js'
import { InMemoryCheckpointStore,type CheckpointStore,type RunCheckpoints } from './checkpoints.js'
import { noopTelemetry,type TelemetryAdapter } from './telemetry.js'

export type ApprovalRequest={capability:string;summary:string;input:unknown}
export type ExecutionIdentity={tenantId:string;userId:string;projectId:string;sessionId?:string}
export type RuntimeContext=ExecutionIdentity&{runId:string;memory:MemoryAdapter;memories:readonly MemoryRecord[];tools:ToolRunner;checkpoints:RunCheckpoints;telemetry:TelemetryAdapter;signal?:AbortSignal;emit:(event:Omit<CaptraEvent,'id'|'protocol'|'runId'|'sequence'|'at'>)=>Promise<void>}
export type CapabilityViewProps<Output>={value:Output;capability:string}
export type ViewReference<Output=unknown>={readonly name:string;readonly component?:unknown;readonly __output?:Output}
export function view<Output>(name:string,component?:unknown):ViewReference<Output>{return Object.freeze({name,component})}

export type ExecutionPolicy={timeoutMs?:number;retries?:number;retryDelayMs?:number}
export type Capability<Input,Output,Name extends string=string>={readonly kind:'capability';readonly mode:'function'|'agent';readonly name:Name;readonly description:string;readonly input:ZodType<Input>;readonly output:ZodType<Output>;readonly scopes:readonly MemoryScope[];readonly permissions:readonly string[];readonly approval:'never'|'required';readonly idempotent:boolean;readonly policy:ExecutionPolicy;readonly tools:readonly Tool<any,any>[];readonly execute:(input:Input,context:RuntimeContext)=>Promise<Output>;readonly view:ViewReference<Output>}
export function defineCapability<const Name extends string,Input,Output>(definition:Omit<Capability<Input,Output,Name>,'kind'|'mode'|'permissions'|'idempotent'|'policy'|'tools'|'view'>&{mode?:'function'|'agent';permissions?:readonly string[];idempotent?:boolean;policy?:ExecutionPolicy;tools?:readonly Tool<any,any>[];view:ViewReference<Output>|unknown}):Capability<Input,Output,Name>{
  const candidate=definition.view as {name?:string;displayName?:string;component?:unknown}
  const resolved=candidate&&typeof candidate==='object'&&typeof candidate.name==='string'?candidate as ViewReference<Output>:view<Output>(candidate?.displayName??candidate?.name??'AnonymousView',definition.view)
  return Object.freeze({...definition,kind:'capability' as const,mode:definition.mode??'function',permissions:definition.permissions??[],idempotent:definition.idempotent??false,policy:definition.policy??{},tools:definition.tools??[],view:resolved})
}

export function capability<const Name extends string,Input,Output>(definition:{name:Name;description:string;input:ZodType<Input>;output:ZodType<Output>;memory?:readonly MemoryScope[];permissions?:readonly string[];approval?:'never'|'required';idempotent?:boolean;policy?:ExecutionPolicy;tools?:readonly Tool<any,any>[];mode?:'function'|'agent';run:(input:Input,context:RuntimeContext)=>Promise<Output>;view:ViewReference<Output>|unknown}):Capability<Input,Output,Name>{
  return defineCapability({name:definition.name,description:definition.description,input:definition.input,output:definition.output,scopes:definition.memory??[],permissions:definition.permissions,approval:definition.approval??'never',idempotent:definition.idempotent,policy:definition.policy,tools:definition.tools,mode:definition.mode,execute:definition.run,view:definition.view})
}

export type Hook={name:string;beforeCapability?:(name:string,input:unknown,context:RuntimeContext)=>Promise<unknown>;afterCapability?:(name:string,output:unknown,context:RuntimeContext)=>Promise<unknown>}
export function defineHook(hook:Hook):Hook{return Object.freeze(hook)}
export type Surface={readonly mode:'capability-views'}
export function capabilityViews():Surface{return Object.freeze({mode:'capability-views' as const})}
export type AgentApp<C extends readonly Capability<any,any,any>[]=readonly Capability<any,any,any>[] >={name:string;version:string;scopes:readonly MemoryScope[];capabilities:C;tools:readonly Tool<unknown,unknown>[];surface:Surface;hooks:readonly Hook[]}
export type CapabilityName<App extends AgentApp>=App['capabilities'][number]['name']
export type CapabilityByName<App extends AgentApp,Name extends CapabilityName<App>>=Extract<App['capabilities'][number],{name:Name}>
export type CapabilityInput<App extends AgentApp,Name extends CapabilityName<App>>=CapabilityByName<App,Name> extends Capability<infer Input,any,any>?Input:never
export type CapabilityOutput<App extends AgentApp,Name extends CapabilityName<App>>=CapabilityByName<App,Name> extends Capability<any,infer Output,any>?Output:never
export function defineApp<const C extends readonly Capability<any,any,any>[]>(definition:{name:string;version?:string;scopes:readonly MemoryScope[];capabilities:C;tools?:readonly Tool<any,any>[];surface:Surface;hooks?:readonly Hook[]}):AgentApp<C>{
  const names=new Set<string>(); for(const capability of definition.capabilities){if(names.has(capability.name))throw new Error(`Duplicate capability: ${capability.name}`);names.add(capability.name)}
  const toolRegistry=new Map<string,Tool<any,any>>();for(const tool of [...definition.capabilities.flatMap(capability=>capability.tools),...(definition.tools??[])]){const existing=toolRegistry.get(tool.name);if(existing&&existing!==tool)throw new Error(`Duplicate tool: ${tool.name}`);toolRegistry.set(tool.name,tool)}
  return Object.freeze({...definition,version:definition.version??'1.0.0',tools:[...toolRegistry.values()],hooks:definition.hooks??[]})
}

export type RunRequest={capability:string;input:unknown;identity:ExecutionIdentity;idempotencyKey?:string;onEvent?:(event:CaptraEvent)=>void|Promise<void>}
export type CapabilityResult={run:RunRecord;capability:Capability<unknown,unknown>;value:unknown;trace:CaptraEvent[]}
export type RuntimeOptions={memory?:MemoryAdapter;runs?:RunStore;checkpoints?:CheckpointStore;telemetry?:TelemetryAdapter;authorize?:(identity:ExecutionIdentity,permissions:readonly string[])=>Promise<boolean>|boolean;signal?:AbortSignal}
export function createRuntime(app:AgentApp,options:RuntimeOptions|MemoryStore={}){
  const normalized=options instanceof MemoryStore?{memory:options}:options
  const memory=normalized.memory??new MemoryStore(),runs=normalized.runs??new InMemoryRunStore(),checkpoints=normalized.checkpoints??new InMemoryCheckpointStore(),telemetry=normalized.telemetry??noopTelemetry,byName=new Map(app.capabilities.map(c=>[c.name,c]))
  const resultFor=async(run:RunRecord,capability:Capability<unknown,unknown>):Promise<CapabilityResult>=>({run,capability,value:run.output,trace:await runs.events(run.id)})
  async function continueRun(run:RunRecord,capability:Capability<unknown,unknown>):Promise<CapabilityResult>{
    const span=telemetry.startSpan('captra.run',{runId:run.id,capability:capability.name,tenantId:run.identity.tenantId,mode:capability.mode}),startedAt=Date.now()
    const emit:RuntimeContext['emit']=async event=>{const saved=await runs.appendEvent(run.id,event);await runRequestEvents.get(run.id)?.(saved)}
    const context={} as RuntimeContext
    const scopedCheckpoints:RunCheckpoints={save:async(key,state)=>{const saved=await checkpoints.save(run.id,key,state);await emit({type:'checkpoint.saved',capability:capability.name,detail:key,data:{sequence:saved.sequence}});return saved},load:async key=>{const saved=await checkpoints.load(run.id,key);if(saved)await emit({type:'checkpoint.restored',capability:capability.name,detail:key,data:{sequence:saved.sequence}});return saved},list:()=>checkpoints.list(run.id)}
    Object.assign(context,{...run.identity,runId:run.id,memory,memories:[],checkpoints:scopedCheckpoints,telemetry,signal:normalized.signal,emit})
    Object.assign(context,{tools:createToolRunner(app.tools,context,async permissions=>!normalized.authorize||await normalized.authorize(run.identity,permissions))})
    try{
      await emit({type:'run.started',capability:capability.name,detail:'Validated execution started'})
      let input:unknown=capability.input.parse(run.validatedInput??run.input)
      const recalled=await memory.recall(capability.scopes,context,{query:safeQuery(input),limit:20});Object.assign(context,{memories:recalled});await emit({type:'memory.recalled',capability:capability.name,detail:`${recalled.length} records`,data:{count:recalled.length}})
      if(run.validatedInput===undefined)for(const hook of app.hooks){if(hook.beforeCapability)input=await hook.beforeCapability(capability.name,input,context);await emit({type:'hook.completed',capability:capability.name,detail:hook.name,data:{phase:'before'}})}
      if(capability.approval==='required'&&run.approval!=='approved'){await runs.update(run.id,{status:'waiting_for_approval',approval:'pending',validatedInput:input});await emit({type:'approval.requested',capability:capability.name,detail:capability.description,data:{input}});span.setAttribute('status','waiting_for_approval');span.end();telemetry.histogram?.('captra.run.duration',Date.now()-startedAt,{capability:capability.name,status:'waiting_for_approval'});return resultFor((await runs.get(run.id))!,capability)}
      await runs.update(run.id,{status:'running',validatedInput:input});await emit({type:'capability.started',capability:capability.name,detail:'Executing capability function'})
      let output:unknown=capability.output.parse(await executeWithPolicy(capability,input,context));for(const hook of [...app.hooks].reverse()){if(hook.afterCapability)output=await hook.afterCapability(capability.name,output,context);await emit({type:'hook.completed',capability:capability.name,detail:hook.name,data:{phase:'after'}})}
      output=capability.output.parse(output);await runs.update(run.id,{status:'completed',output});await emit({type:'run.completed',capability:capability.name,detail:capability.view.name,data:{view:capability.view.name}});span.setAttribute('status','completed');span.end();telemetry.histogram?.('captra.run.duration',Date.now()-startedAt,{capability:capability.name,status:'completed'});return resultFor((await runs.get(run.id))!,capability)
    }catch(error){const message=error instanceof Error?error.message:'Unknown runtime error';await runs.update(run.id,{status:'failed',error:message});await emit({type:'run.failed',capability:capability.name,detail:message});span.setAttribute('status','failed');span.end(error);telemetry.counter?.('captra.run.failures',1,{capability:capability.name});telemetry.histogram?.('captra.run.duration',Date.now()-startedAt,{capability:capability.name,status:'failed'});throw error}
  }
  const runRequestEvents=new Map<string,RunRequest['onEvent']>()
  async function execute(request:RunRequest){const capability=byName.get(request.capability);if(!capability)throw new Error(`Unknown capability: ${request.capability}`);if(normalized.authorize&&!(await normalized.authorize(request.identity,capability.permissions)))throw new Error(`Not authorized to run ${capability.name}`);if(request.idempotencyKey){const existing=await runs.findByIdempotencyKey(request.identity.tenantId,request.idempotencyKey);if(existing)return resultFor(existing,capability)}const run=await runs.create({app:app.name,appVersion:app.version,capability:capability.name,input:request.input,identity:request.identity,idempotencyKey:request.idempotencyKey});if(run.status!=='created')return resultFor(run,capability);if(request.onEvent)runRequestEvents.set(run.id,request.onEvent);try{return await continueRun(run,capability)}finally{runRequestEvents.delete(run.id)}}
  async function approve(runId:string,decision:'approved'|'rejected'){const run=await runs.get(runId);if(!run)throw new Error(`Unknown run: ${runId}`);if(run.status!=='waiting_for_approval')throw new Error(`Run ${runId} is not waiting for approval`);const capability=byName.get(run.capability)!;await runs.update(runId,{approval:decision});await runs.appendEvent(runId,{type:decision==='approved'?'approval.approved':'approval.rejected',capability:capability.name,detail:decision});if(decision==='rejected'){await runs.update(runId,{status:'cancelled'});return resultFor((await runs.get(runId))!,capability)}return continueRun((await runs.get(runId))!,capability)}
  async function enqueue(request:RunRequest,queue:WorkQueue,options:{maxAttempts?:number;availableAt?:number}={}){const capability=byName.get(request.capability);if(!capability)throw new Error(`Unknown capability: ${request.capability}`);if(normalized.authorize&&!(await normalized.authorize(request.identity,capability.permissions)))throw new Error(`Not authorized to run ${capability.name}`);if(request.idempotencyKey){const existing=await runs.findByIdempotencyKey(request.identity.tenantId,request.idempotencyKey);if(existing)return existing}capability.input.parse(request.input);const run=await runs.create({app:app.name,appVersion:app.version,capability:capability.name,input:request.input,identity:request.identity,idempotencyKey:request.idempotencyKey});if(run.status!=='created')return run;await runs.update(run.id,{status:'queued'});await runs.appendEvent(run.id,{type:'run.queued',capability:capability.name,detail:'Queued for background execution'});try{await queue.enqueue({runId:run.id,...options})}catch(error){const message=error instanceof Error?error.message:'Queue operation failed';await runs.update(run.id,{status:'failed',error:message});await runs.appendEvent(run.id,{type:'run.failed',capability:capability.name,detail:message});throw error}return (await runs.get(run.id))!}
  async function resume(runId:string){const run=await runs.get(runId);if(!run)throw new Error(`Unknown run: ${runId}`);const capability=byName.get(run.capability);if(!capability)throw new Error(`Unknown capability: ${run.capability}`);if(['completed','cancelled','waiting_for_approval'].includes(run.status))return resultFor(run,capability);return continueRun(run,capability)}
  async function cancel(runId:string){const run=await runs.get(runId);if(!run)throw new Error(`Unknown run: ${runId}`);if(['completed','failed','cancelled'].includes(run.status))throw new Error(`Run ${runId} cannot be cancelled`);await runs.update(runId,{status:'cancelled'});await runs.appendEvent(runId,{type:'run.cancelled',capability:run.capability,detail:'Cancelled'});return runs.get(runId)}
  async function replay(runId:string){const run=await runs.get(runId);if(!run)throw new Error(`Unknown run: ${runId}`);return {run,events:await runs.events(runId),checkpoints:await checkpoints.list(runId)}}
  return {app,memory,runs,checkpoints,telemetry,execute,enqueue,resume,replay,approve,cancel,async run(name:string,input:unknown,legacy:Omit<ExecutionIdentity,'tenantId'>&{tenantId?:string;approve:(request:ApprovalRequest)=>Promise<boolean>}){let result=await execute({capability:name,input,identity:{tenantId:legacy.tenantId??'default',userId:legacy.userId,projectId:legacy.projectId}});if(result.run.status==='waiting_for_approval'){const allowed=await legacy.approve({capability:name,summary:result.capability.description,input});result=await approve(result.run.id,allowed?'approved':'rejected');if(!allowed)throw new Error('Approval rejected')}return result}}
}
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
