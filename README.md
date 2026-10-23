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

## Packages

- `@captra/core` — contracts, runtime, durable runs, memory, events, planners, manifests
- `@captra/client` — typed HTTP client and live event streaming
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
