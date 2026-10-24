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

An agent is a capability whose implementation is a guarded model/tool loop. Its tools are automatically registered with the app:

```ts
export const researcher=agent({
  name:'research', instructions:'Research carefully and cite the evidence.',
  input:ResearchRequest, output:ResearchReport,
  model, tools:[searchDocs,fetchPage],
  budget:{maxSteps:6,maxToolCalls:10,maxTokens:20_000},
  view:ResearchReportCard,
})
```

This preserves one mental model for developers: deterministic capabilities and model-directed agents use the same schemas, memory, tools, approvals, events, workers, and UI boundary.

The same app contract provides end-to-end types to browser and server clients without generating a second schema:

```ts
const client=createCaptraClient<typeof app>({baseUrl:'/api/captra'})
const result=await client.execute('refund',{amount:48})
// capability names, input, and result.value are inferred from app
```

Remote responses contain a small transport-safe capability descriptor rather than runtime functions or validation objects. React resolves the returned view name against an explicit local component registry: `<CapabilityOutput result={result} views={{RefundCard}} />`.

Use the OpenAI Responses API through the provider-neutral model contract:

```ts
import { createOpenAI } from '@captra/openai'

const model=createOpenAI({model:'gpt-5.4'})
```

The adapter supports function calls, response continuation, usage accounting, streaming, cancellation, and bounded retries for rate limits and transient server errors.
Create it only in trusted server code; never expose `OPENAI_API_KEY` in a browser bundle.

Adaptive memory wraps any memory store, including PostgreSQL:

```ts
const memory=new AdaptiveMemoryStore(
  new PostgresMemoryStore(pool),
  createOpenAIEmbeddings({model:'text-embedding-3-small'}),
  {limit:12,minSimilarity:.35,deduplicateSimilarity:.98},
)

await memory.ingest(conversation,{tenantId,scope:'user',ownerId:userId},createMemoryExtractor(model))
```

Recall is tenant- and scope-aware, excludes expired records, ranks candidates by cosine similarity, suppresses near duplicates, and injects only selected memories into agent context.

For persistent vectors across processes and workers, enable the optional `pgvector` adapter:

```ts
await migrateCaptraVectors(pool,1536)

const memory=new PostgresSemanticMemoryStore(
  pool,
  createOpenAIEmbeddings({model:'text-embedding-3-small',dimensions:1536}),
  {dimensions:1536,limit:12,minSimilarity:.35},
)
```

Vector dimensions are validated before writes and searches. Similarity ranking and tenant/scope filtering execute together inside PostgreSQL.

## Resumable agent checkpoints

Agent state is checkpointed before and after every tool call. A retried worker restores the conversation, provider continuation state, budgets, and pending call index:

```ts
const runtime=createRuntime(app,{
  runs:new PostgresRunStore(pool),
  checkpoints:new PostgresCheckpointStore(pool),
})

const replay=await runtime.replay(runId)
```

Completed tool calls are not repeated after recovery. `replay()` returns the durable run, ordered event trace, and checkpoint history for debugging or deterministic inspection.

## Observability and evaluations

Pass a `TelemetryAdapter` to capture run, tool, and model spans plus duration, failure, and token metrics. `InMemoryTelemetry` is included for local inspection and tests.

```ts
const telemetry=new InMemoryTelemetry()
const runtime=createRuntime(app,{telemetry})

const report=await runEvaluation(runtime,cases)
enforceEvaluation(report,{minPassRate:.95,maxFailures:2})
```

`recordModel()` captures provider-neutral model interactions. `replayModel()` returns those responses deterministically during tests, eliminating API cost and model variance from regression suites.
Use `createOpenTelemetryAdapter(tracer,meter)` to export the same signals through an existing OpenTelemetry SDK and exporter.

## Runtime primitives

- `capability()` — the typed user-facing action contract
- `defineTool()` — a reusable, permission-aware integration function
- `defineApp()` — the registry and deployment boundary
- `createRuntime()` — validated execution, approvals, cancellation, events, and idempotency
- `MemoryAdapter` — organization, user, project, session, and task memory
- `ModelAdapter` — provider-neutral generation and streaming
- `createStructuredGenerator()` — schema-validated model output
- `createModelPlanner()` — natural-language capability selection
- `agent()` — budgeted multi-step model/tool execution as a typed capability
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
- `@captra/openai` — OpenAI Responses API generation, tools, continuation, usage, and streaming
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

## Releases

Every library package is compiled to ESM JavaScript with TypeScript declarations, declaration maps, source maps, explicit export maps, and restricted npm file lists. Changesets coordinates framework versions and the release workflow opens version PRs before publishing with npm provenance. Packages are not published until the repository is configured with an npm trusted publisher or `NPM_TOKEN`.
