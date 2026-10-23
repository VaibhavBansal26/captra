# Captra foundation

Captra is a typed contract layer for agent-powered applications. A capability owns its input and output schemas, permissions, memory scopes, approval policy, executable function, and safe UI reference.

```tsx
export const refund = defineCapability({
  name: 'refund',
  description: 'Refund a captured payment',
  input: z.object({ paymentId: z.string(), amount: z.number().positive() }),
  output: z.object({ refundId: z.string() }),
  permissions: ['refund:create'],
  scopes: ['user', 'project'],
  approval: 'required',
  idempotent: true,
  execute: ({ paymentId, amount }, ctx) => billing.refund({ paymentId, amount, key: ctx.runId }),
  view: RefundCard,
})
```

## Runtime

```ts
const runtime = createRuntime(app, {
  memory: postgresMemory,
  runs: postgresRuns,
  authorize: (identity, permissions) => policy.can(identity, permissions),
})

const run = await runtime.execute({
  capability: 'refund',
  input: { paymentId: 'pay_123', amount: 48 },
  identity: { tenantId: 'acme', userId: 'u_1', projectId: 'support' },
  idempotencyKey: 'refund-pay_123',
})

if (run.run.status === 'waiting_for_approval') {
  await runtime.approve(run.run.id, 'approved')
}
```

## Backend integration

`createCaptraHandler` consumes and returns Web Standard `Request` and `Response` values, so adapters only need to translate their framework request once.

```ts
const handler = createCaptraHandler(runtime, {
  auth: async request => authenticate(request),
})
```

Routes:

- `GET /captra/manifest`
- `POST /captra/runs`
- `GET /captra/runs/:id`
- `GET /captra/runs/:id/events?after=0`
- `POST /captra/runs/:id/approve`
- `POST /captra/runs/:id/reject`

## Adapter contracts

- `MemoryAdapter` lets Postgres, Redis, vector stores, or specialized memory engines provide recall and retention.
- `RunStore` persists resumable runs, interrupts, idempotency keys, and the ordered event log.
- `PlannerAdapter` lets OpenAI Agents, Mastra, LangGraph, or a deterministic router select capabilities.
- `AuthResolver` derives identity at the server boundary. Identity is never accepted from the model or browser payload.

The in-memory adapters are for development and tests. Production adapters must make idempotency-key creation atomic and encrypt or redact sensitive data according to application policy.
