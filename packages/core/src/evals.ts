import type { CapabilityResult,ExecutionIdentity,Runtime } from './core.js'

export type EvaluationScore={name:string;value:number;passed:boolean;detail?:string}
export type EvaluationScorer={name:string;score:(result:CapabilityResult,test:EvaluationCase)=>number|EvaluationScore|Promise<number|EvaluationScore>;threshold?:number}
export type EvaluationCase={name:string;capability:string;input:unknown;identity:ExecutionIdentity;assert?:(result:CapabilityResult)=>boolean|Promise<boolean>;scorers?:readonly EvaluationScorer[];tags?:readonly string[];limits?:{maxDurationMs?:number;maxTokens?:number;maxCostUsd?:number}}
export type EvaluationSuite={version:1;name:string;cases:readonly EvaluationCase[];metadata?:Readonly<Record<string,string>>}
export type EvaluationResult={name:string;passed:boolean;durationMs:number;runId?:string;error?:string;tags:readonly string[];tokens:number;costUsd:number;scores:readonly EvaluationScore[]}
export type EvaluationReport={suite?:string;variant?:string;results:EvaluationResult[];passed:number;failed:number;passRate:number;durationMs:number;tokens:number;costUsd:number;p95DurationMs:number;scoreAverages:Record<string,number>}
export type EvaluationThresholds={minPassRate?:number;maxFailures?:number;maxDurationMs?:number;maxP95DurationMs?:number;maxTokens?:number;maxCostUsd?:number;minScores?:Readonly<Record<string,number>>}
export type EvaluationVariant={name:string;runtime:Runtime}
export type EvaluationComparison={baseline:string;reports:EvaluationReport[];deltas:Array<{variant:string;passRate:number;durationMs:number;tokens:number;costUsd:number;scores:Record<string,number>}>}

export class EvaluationRegressionError extends Error{
  readonly code='evaluation_regression'
  constructor(readonly failures:readonly string[],readonly report:EvaluationReport){super(`Evaluation regression: ${failures.join('; ')}`);this.name='EvaluationRegressionError'}
}

export async function runEvaluation(runtime:Runtime,casesOrSuite:readonly EvaluationCase[]|EvaluationSuite,options:{variant?:string}={}):Promise<EvaluationReport>{
  const suite=Array.isArray(casesOrSuite)?undefined:casesOrSuite as EvaluationSuite,cases=Array.isArray(casesOrSuite)?casesOrSuite:(casesOrSuite as EvaluationSuite).cases,started=Date.now(),results:EvaluationResult[]=[]
  for(const test of cases){
    const caseStarted=Date.now()
    try{
      const result=await runtime.execute({capability:test.capability,input:test.input,identity:test.identity}),durationMs=Date.now()-caseStarted,usage=usageFrom(result),scores=await scoreResult(result,test),failures:string[]=[]
      if(test.assert&&!(await test.assert(result)))failures.push('Assertion returned false')
      for(const score of scores)if(!score.passed)failures.push(`${score.name} score ${score.value} is below threshold`)
      if(durationMs>(test.limits?.maxDurationMs??Number.POSITIVE_INFINITY))failures.push(`duration ${durationMs}ms exceeds ${test.limits?.maxDurationMs}ms`)
      if(usage.tokens>(test.limits?.maxTokens??Number.POSITIVE_INFINITY))failures.push(`tokens ${usage.tokens} exceeds ${test.limits?.maxTokens}`)
      if(usage.costUsd>(test.limits?.maxCostUsd??Number.POSITIVE_INFINITY))failures.push(`cost $${usage.costUsd.toFixed(6)} exceeds $${test.limits?.maxCostUsd}`)
      results.push({name:test.name,passed:failures.length===0&&result.run.status==='completed',durationMs,runId:result.run.id,tags:test.tags??[],tokens:usage.tokens,costUsd:usage.costUsd,scores,...(failures.length?{error:failures.join('; ')}:{})})
    }catch(error){results.push({name:test.name,passed:false,durationMs:Date.now()-caseStarted,error:error instanceof Error?error.message:String(error),tags:test.tags??[],tokens:0,costUsd:0,scores:[]})}
  }
  return reportFrom(results,{suite:suite?.name,variant:options.variant,durationMs:Date.now()-started})
}

export async function compareEvaluations(variants:readonly EvaluationVariant[],casesOrSuite:readonly EvaluationCase[]|EvaluationSuite,baseline=variants[0]?.name):Promise<EvaluationComparison>{
  if(!variants.length)throw new Error('At least one evaluation variant is required')
  if(!variants.some(variant=>variant.name===baseline))throw new Error(`Unknown evaluation baseline: ${baseline}`)
  const reports:EvaluationReport[]=[]
  for(const variant of variants)reports.push(await runEvaluation(variant.runtime,casesOrSuite,{variant:variant.name}))
  const base=reports.find(report=>report.variant===baseline)!
  return {baseline:baseline!,reports,deltas:reports.filter(report=>report!==base).map(report=>({variant:report.variant!,passRate:report.passRate-base.passRate,durationMs:report.durationMs-base.durationMs,tokens:report.tokens-base.tokens,costUsd:report.costUsd-base.costUsd,scores:scoreDeltas(report.scoreAverages,base.scoreAverages)}))}
}

export function enforceEvaluation(report:EvaluationReport,thresholds:EvaluationThresholds){
  const failures:string[]=[]
  if(report.passRate<(thresholds.minPassRate??0))failures.push(`pass rate ${percent(report.passRate)} is below ${percent(thresholds.minPassRate??0)}`)
  if(report.failed>(thresholds.maxFailures??Number.MAX_SAFE_INTEGER))failures.push(`${report.failed} failures exceeds ${thresholds.maxFailures}`)
  if(report.durationMs>(thresholds.maxDurationMs??Number.MAX_SAFE_INTEGER))failures.push(`duration ${report.durationMs}ms exceeds ${thresholds.maxDurationMs}ms`)
  if(report.p95DurationMs>(thresholds.maxP95DurationMs??Number.MAX_SAFE_INTEGER))failures.push(`p95 duration ${report.p95DurationMs}ms exceeds ${thresholds.maxP95DurationMs}ms`)
  if(report.tokens>(thresholds.maxTokens??Number.MAX_SAFE_INTEGER))failures.push(`${report.tokens} tokens exceeds ${thresholds.maxTokens}`)
  if(report.costUsd>(thresholds.maxCostUsd??Number.POSITIVE_INFINITY))failures.push(`cost $${report.costUsd.toFixed(6)} exceeds $${thresholds.maxCostUsd}`)
  for(const [name,minimum] of Object.entries(thresholds.minScores??{}))if((report.scoreAverages[name]??0)<minimum)failures.push(`${name} score ${report.scoreAverages[name]??0} is below ${minimum}`)
  if(failures.length)throw new EvaluationRegressionError(failures,report)
  return report
}

export function formatEvaluation(report:EvaluationReport,format:'json'|'markdown'|'junit'='markdown'){
  if(format==='json')return JSON.stringify(report,null,2)
  if(format==='junit')return junit(report)
  const heading=`# ${report.suite??'Captra evaluation'}${report.variant?` — ${report.variant}`:''}`,summary=`${report.passed}/${report.results.length} passed · ${percent(report.passRate)} · ${report.tokens} tokens · $${report.costUsd.toFixed(4)} · p95 ${report.p95DurationMs}ms`,rows=report.results.map(result=>`| ${result.passed?'✓':'✗'} | ${escapeCell(result.name)} | ${result.durationMs}ms | ${result.tokens} | $${result.costUsd.toFixed(4)} | ${escapeCell(result.error??'')} |`)
  return [heading,'',summary,'','| | Case | Duration | Tokens | Cost | Failure |','|---|---|---:|---:|---:|---|',...rows].join('\n')
}

async function scoreResult(result:CapabilityResult,test:EvaluationCase){const scores:EvaluationScore[]=[];for(const scorer of test.scorers??[]){const value=await scorer.score(result,test),score=typeof value==='number'?{name:scorer.name,value,passed:value>=(scorer.threshold??0)}:{...value,name:value.name||scorer.name};scores.push(score)}return scores}
function usageFrom(result:CapabilityResult){let tokens=0,costUsd=0;for(const event of result.trace)if(event.type==='budget.committed'){tokens+=numberFrom(event.data,'tokens');costUsd+=numberFrom(event.data,'costUsd')}return {tokens,costUsd}}
function reportFrom(results:EvaluationResult[],extra:{suite?:string;variant?:string;durationMs:number}):EvaluationReport{const passed=results.filter(result=>result.passed).length,durations=results.map(result=>result.durationMs).sort((a,b)=>a-b),scoreGroups=new Map<string,number[]>();for(const result of results)for(const score of result.scores)scoreGroups.set(score.name,[...(scoreGroups.get(score.name)??[]),score.value]);return {...extra,results,passed,failed:results.length-passed,passRate:results.length?passed/results.length:1,tokens:results.reduce((total,result)=>total+result.tokens,0),costUsd:results.reduce((total,result)=>total+result.costUsd,0),p95DurationMs:durations.length?durations[Math.min(durations.length-1,Math.ceil(durations.length*.95)-1)]:0,scoreAverages:Object.fromEntries([...scoreGroups].map(([name,values])=>[name,values.reduce((sum,value)=>sum+value,0)/values.length]))}}
function scoreDeltas(current:Record<string,number>,baseline:Record<string,number>){return Object.fromEntries([...new Set([...Object.keys(current),...Object.keys(baseline)])].map(name=>[name,(current[name]??0)-(baseline[name]??0)]))}
function junit(report:EvaluationReport){const cases=report.results.map(result=>`  <testcase name="${xml(result.name)}" time="${(result.durationMs/1000).toFixed(3)}">${result.passed?'':`<failure message="${xml(result.error??'Evaluation failed')}"/>`}</testcase>`).join('\n');return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${xml(report.suite??'Captra evaluation')}" tests="${report.results.length}" failures="${report.failed}" time="${(report.durationMs/1000).toFixed(3)}">\n${cases}\n</testsuite>`}
function numberFrom(data:unknown,key:string){const value=data&&typeof data==='object'?(data as Record<string,unknown>)[key]:0;return typeof value==='number'?value:0}
function escapeCell(value:string){return value.replaceAll('|','\\|').replaceAll('\n',' ')}
function xml(value:string){return value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
const percent=(value:number)=>`${(value*100).toFixed(1)}%`
