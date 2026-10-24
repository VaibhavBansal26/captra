import { createElement, useCallback, useMemo, useState, type ComponentType } from 'react'
import { createRuntime, type AgentApp, type CapabilityResult, type ExecutionIdentity, type RemoteCapabilityResult, type RuntimeOptions } from '@captra/core'

export type UseCaptraOptions=RuntimeOptions&{identity?:ExecutionIdentity;approve?:(result:CapabilityResult)=>Promise<boolean>}
export function useAgentApp(app: AgentApp, options:UseCaptraOptions={}) {
  const runtime = useMemo(() => createRuntime(app, options), [app, options.memory, options.runs, options.authorize, options.signal])
  const [result, setResult] = useState<CapabilityResult | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (capability: string, input: unknown) => {
    setPending(true)
    setError(null)
    try {
      const identity=options.identity??{tenantId:'default',userId:'anonymous',projectId:'default'}
      let next=await runtime.execute({capability,input,identity})
      if(next.run.status==='waiting_for_approval'&&options.approve)next=await runtime.approve(next.run.id,(await options.approve(next))?'approved':'rejected')
      setResult(next)
      return next
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unknown runtime error')
      return null
    } finally {
      setPending(false)
    }
  }, [runtime, options.identity, options.approve])

  return { runtime, result, pending, error, run }
}

export function useCapability(app:AgentApp,name:string,options:UseCaptraOptions={}){
  const state=useAgentApp(app,options)
  return {...state,run:useCallback((input:unknown)=>state.run(name,input),[state.run,name])}
}

export type RemoteCaptraClient={execute:(name:any,input:any)=>Promise<RemoteCapabilityResult>;approve:(id:string)=>Promise<RemoteCapabilityResult>;reject:(id:string)=>Promise<RemoteCapabilityResult>}
export function useRemoteCapability(client:RemoteCaptraClient,name:string){
  const [result,setResult]=useState<RemoteCapabilityResult|null>(null),[pending,setPending]=useState(false),[error,setError]=useState<string|null>(null)
  const run=useCallback(async(input:unknown)=>{setPending(true);setError(null);try{const next=await client.execute(name,input);setResult(next);return next}catch(caught){setError(caught instanceof Error?caught.message:'Unknown runtime error');return null}finally{setPending(false)}},[client,name])
  const approve=useCallback(async()=>{if(!result)return null;const next=await client.approve(result.run.id);setResult(next);return next},[client,result])
  const reject=useCallback(async()=>{if(!result)return null;const next=await client.reject(result.run.id);setResult(next);return next},[client,result])
  return {run,approve,reject,result,pending,error}
}

export const useCaptra = useAgentApp

export function CapabilityOutput({ result, views = {} }: { result: CapabilityResult|RemoteCapabilityResult; views?:Record<string,ComponentType<any>> }) {
  if (result.run.status !== 'completed') return null
  const reference=result.capability.view
  const component=typeof reference==='string'?views[reference]:reference.component as ComponentType<any>|undefined
  if (!component) return null
  return createElement(component, {
    value: result.value,
    capability: result.capability.name,
  })
}
