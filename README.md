# Captra

Captra is a capability-first framework for type-safe, memory-aware AI applications.

It keeps the application contract small while the runtime handles validation, tools, scoped memory, authorization, approvals, durable run events, and generated UI boundaries.

```bash
npx create-captra my-app
cd my-app
npm install
npx captra dev
```

```tsx
export const refund=capability({
  name:'refund',
  input:RefundInput,
  output:RefundResult,
  memory:['user','project'],
  permissions:['refund:create'],
  approval:'required',
  run:refundPayment,
  view:RefundCard,
})
```

Capabilities can call typed tools through their runtime context:

```ts
const lookupCustomer=defineTool({
  name:'customers.lookup',
  description:'Find a customer by email',
  input:z.object({email:z.email()}),
  output:Customer,
  execute:({email})=>crm.customers.find(email),
})

const support=capability({
  // input, output, memory, approval and view omitted
  run:async ({email},ctx)=>ctx.tools.call('customers.lookup',{email}),
})

export default defineApp({
  name:'Support', scopes:['user','project'],
  tools:[lookupCustomer,...builtinTools],
  capabilities:[support], surface:capabilityViews(),
})
```

## Runtime primitives

- `capability()` — the typed user-facing action contract
- `defineTool()` — a reusable, permission-aware integration function
- `defineApp()` — the registry and deployment boundary
- `createRuntime()` — validated execution, approvals, cancellation, events, and idempotency
- `MemoryAdapter` — organization, user, project, session, and task memory
- `ModelAdapter` — provider-neutral generation and streaming
- `createStructuredGenerator()` — schema-validated model output
- `createModelPlanner()` — natural-language capability selection
- `builtinTools` — remember, recall, forget, and JSON HTTP operations
- `useCaptra()` / `useCapability()` — React orchestration hooks

## Durable PostgreSQL runtime

Captra accepts any `pg`-compatible client exposing `query(text, values)`, so the adapter is not tied to a specific Postgres vendor:

```ts
import { createRuntime } from '@captra/core'
import { migrateCaptra, PostgresMemoryStore, PostgresRunStore } from '@captra/postgres'

await migrateCaptra(pool)

const runtime=createRuntime(app,{
  runs:new PostgresRunStore(pool),
  memory:new PostgresMemoryStore(pool),
  authorize:async (identity,permissions)=>policy.allows(identity,permissions),
})
```

The schema includes tenant-scoped memory indexes, durable event history, and a database-enforced idempotency key. Run event sequence allocation is serialized on the run row to remain safe under concurrent workers.

Background runs use leased queue jobs, allowing another worker to recover work after a crashed worker's lease expires:

```ts
const queue=new PostgresWorkQueue(pool)
await runtime.enqueue({capability:'build-report',input,identity},queue)

const worker=createWorker({runtime,queue,workerId:process.env.WORKER_ID})
await worker.runOnce()
```

## Packages

- `@captra/core` — contracts, runtime, durable runs, memory, events, planners, manifests
- `@captra/client` — typed HTTP client and live event streaming
- `@captra/postgres` — durable run, event, and multi-level memory storage
- `@captra/react` — hooks and safe capability-view rendering
- `@captra/server` — Web Standard backend handler
- `@captra/cli` — create, dev, build, test, and inspect commands
- `create-captra` — project scaffolding

## Commands

```bash
captra create my-app
captra dev my-app
captra build my-app
captra test my-app
captra inspect my-app
```

The runtime is model- and backend-independent. Implement `PlannerAdapter`, `MemoryAdapter`, and `RunStore` to connect an existing agent runtime and infrastructure.
