import { describe,expect,it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { z } from 'zod'
import { capability,capabilityViews,defineApp,type RemoteCapabilityResult,type RunRecord } from '@captra/core'
import { createCaptraClient } from '@captra/client'
import { ApprovalPanel,CapabilityBoundary,EventTimeline,RunStatus,useRemoteCapability } from './index.js'

const run:RunRecord={id:'run-1',app:'Test',appVersion:'1.0.0',capability:'summarize',status:'waiting_for_approval',identity:{tenantId:'t1',userId:'u1',projectId:'p1'},input:{},approval:'pending',createdAt:1,updatedAt:1}
const result:RemoteCapabilityResult={run,capability:{name:'summarize',mode:'agent',description:'Summarize the document',view:'Summary'},value:undefined,trace:[]}

describe('@captra/react primitives',()=>{
  it('renders accessible run status with customizable language',()=>{const html=renderToStaticMarkup(<RunStatus run={run} labels={{waiting_for_approval:'Needs your call'}}/>);expect(html).toContain('role="status"');expect(html).toContain('data-status="waiting_for_approval"');expect(html).toContain('Needs your call')})
  it('renders approval controls only while a run is waiting',()=>{const html=renderToStaticMarkup(<ApprovalPanel result={result} onApprove={()=>{}} onReject={()=>{}}/>);expect(html).toContain('Human approval required');expect(html).toContain('Approve');expect(renderToStaticMarkup(<ApprovalPanel result={{...result,run:{...run,status:'completed'}}} onApprove={()=>{}} onReject={()=>{}}/>)).toBe('')})
  it('renders a semantic event timeline',()=>{const html=renderToStaticMarkup(<EventTimeline events={[{id:'event-1',protocol:'1.0',runId:'run-1',sequence:1,at:1,type:'run.started',capability:'summarize',detail:'Started safely'}]}/>);expect(html).toContain('<ol');expect(html).toContain('run.started');expect(html).toContain('Started safely')})
  it('combines status, local views, approvals, errors, and traces in one boundary',()=>{const Summary=({value}:{value:{text:string}})=><article>{value.text}</article>,complete={...result,run:{...run,status:'completed' as const,output:{text:'Done'}},value:{text:'Done'}};const html=renderToStaticMarkup(<CapabilityBoundary result={complete} views={{Summary}} showTrace error="Heads up"/>);expect(html).toContain('Heads up');expect(html).toContain('Completed');expect(html).toContain('<article>Done</article>')})
  it('binds remote hook input and output to the app contract',()=>{const greet=capability({name:'greet',description:'Greet',input:z.object({name:z.string()}),output:z.object({message:z.string()}),approval:'never',run:async({name})=>({message:name}),view:{name:'Greeting'}}),app=defineApp({name:'Typed',scopes:[],capabilities:[greet],surface:capabilityViews()}),client=createCaptraClient<typeof app>({baseUrl:'https://captra.test',fetch:async()=>Response.json({})});function Probe(){const state=useRemoteCapability(client,'greet'),invoke=()=>state.run({name:'Ada'});return <button onClick={invoke}>{state.result?.value.message??'Ready'}</button>}expect(renderToStaticMarkup(<Probe/>)).toContain('Ready')})
})
