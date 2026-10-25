# @captra-ai/postgres

Durable PostgreSQL adapters for Captra conversations, runs, events, checkpoints, effect receipts, memory, queues, shared state, and optional pgvector semantic memory.

```bash
npm install @captra-ai/postgres @captra-ai/core @captra-ai/state pg
```

```ts
import { migrateCaptra, PostgresConversationStore, PostgresRunStore, PostgresCheckpointStore } from '@captra-ai/postgres'

await migrateCaptra(pool)
const runtime = createRuntime(app, {
  conversations: new PostgresConversationStore(pool),
  runs: new PostgresRunStore(pool),
  checkpoints: new PostgresCheckpointStore(pool),
})
```

Conversation IDs are scoped by tenant and bound to the user who creates them. Message IDs are deduplicated and history uses stable backward cursor pagination. All durable memory, shared state, conversations, and effect receipts are tenant-scoped. Run migrations during deployment before starting workers.

[PostgreSQL documentation](https://vaibhavbansal26.github.io/captra/integrations) · [GitHub](https://github.com/VaibhavBansal26/captra/tree/main/packages/postgres) · MIT
