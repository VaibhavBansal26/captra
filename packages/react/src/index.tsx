import { createElement, useCallback, useMemo, useState, type ComponentType } from 'react'
import { createRuntime, MemoryStore, type AgentApp, type CapabilityResult } from '@captra/core'

const demoMemory = new MemoryStore([
  { id: 'mem_1', scope: 'user', ownerId: 'alex', type: 'preference', content: 'Prefers concise explanations', confidence: .94, createdAt: Date.now() },
  { id: 'mem_2', scope: 'project', ownerId: 'support', type: 'decision', content: 'Refunds above $25 require approval', confidence: 1, createdAt: Date.now() },
  { id: 'mem_3', scope: 'task', ownerId: 'current', type: 'working-state', content: 'Investigating duplicate invoice inv_2048', confidence: .88, createdAt: Date.now() },
])

export function useAgentApp(app: AgentApp) {
  const runtime = useMemo(() => createRuntime(app, demoMemory), [app])
  const [result, setResult] = useState<CapabilityResult | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async (capability: string, input: unknown) => {
    setPending(true)
    setError(null)
    try {
      const next = await runtime.run(capability, input, {
        userId: 'alex',
        projectId: 'support',
        approve: async () => true,
      })
      setResult(next)
      return next
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unknown runtime error')
      return null
    } finally {
      setPending(false)
    }
  }, [runtime])

  return { runtime, result, pending, error, run }
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
