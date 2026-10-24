# @captra-ai/state

Typed reactive state for Captra applications, with deduplicated loading, subscriptions, invalidation, optimistic updates, hydration, persistence, and coordinated multi-agent state.

```bash
npm install @captra-ai/state
```

```ts
import { createState } from '@captra-ai/state'

const state = createState()
await state.fetch(['todos'], () => api.listTodos(), { staleTime: 30_000 })
state.invalidate(['todos'])
```

Shared state uses optimistic versions and optional short leases with fencing tokens, so agents do not hold database locks during model inference.

[State documentation](https://vaibhavbansal26.github.io/captra/state-and-memory) · [GitHub](https://github.com/VaibhavBansal26/captra/tree/main/packages/state) · MIT
