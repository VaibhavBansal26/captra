# @captra-ai/postgres

Durable PostgreSQL adapters for Captra runs, events, checkpoints, effect receipts, memory, queues, shared state, and optional pgvector semantic memory.

```bash
npm install @captra-ai/postgres @captra-ai/core @captra-ai/state pg
```

```ts
import { migrateCaptra, PostgresRunStore, PostgresCheckpointStore } from '@captra-ai/postgres'

await migrateCaptra(pool)
const runtime = createRuntime(app, {
  runs: new PostgresRunStore(pool),
  checkpoints: new PostgresCheckpointStore(pool),
})
```

All durable memory, shared state, and effect receipts are tenant-scoped. Run migrations during deployment before starting workers.

[PostgreSQL documentation](https://vaibhavbansal26.github.io/captra/integrations) · [GitHub](https://github.com/VaibhavBansal26/captra/tree/main/packages/postgres) · MIT
