# Captra

Captra is a capability-first framework for type-safe, memory-aware AI applications.

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

## Packages

- `@captra/core` — contracts, runtime, durable runs, memory, events, planners, manifests
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
