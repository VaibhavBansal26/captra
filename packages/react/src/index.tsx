import { createElement, useCallback, useMemo, useState, type ComponentType } from 'react'
import { createRuntime, MemoryStore, type AgentApp, type CapabilityResult, type ExecutionIdentity, type RuntimeOptions } from '@captra/core'

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

export const useCaptra = useAgentApp

export function CapabilityOutput({ result }: { result: CapabilityResult }) {
  if (result.run.status !== 'completed') return null
  if (!result.capability.view.component) return null
  return createElement(result.capability.view.component as ComponentType<any>, {
    value: result.value,
    capability: result.capability.name,
  })
}
