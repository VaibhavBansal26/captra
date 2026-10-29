# @captra-ai/postgres

Durable PostgreSQL adapters for Captra conversations, runs, events, checkpoints, effect receipts, memory, queues, shared state, and optional pgvector semantic memory.

```bash
npm install @captra-ai/postgres @captra-ai/core @captra-ai/state pg
```

```ts
import { migrateCaptra, PostgresConversationStore, PostgresRunCompletionStore, PostgresRunStore, PostgresCheckpointStore } from '@captra-ai/postgres'

await migrateCaptra(pool)
const runtime = createRuntime(app, {
  conversations: new PostgresConversationStore(pool),
  runs: new PostgresRunStore(pool),
  completion: new PostgresRunCompletionStore(pool),
  checkpoints: new PostgresCheckpointStore(pool),
})
```

Always configure `PostgresRunCompletionStore` with durable chat. It uses one checked-out connection and one transaction to publish the assistant message, usage record, `run.completed` event, and terminal run state. A failed write rolls the entire completion back, while deterministic message and usage IDs make an uncertain post-commit retry safe.

Conversation IDs are scoped by tenant and bound to the user who creates them. Message IDs are deduplicated and history uses stable backward cursor pagination. All durable memory, shared state, conversations, and effect receipts are tenant-scoped. Run migrations during deployment before starting workers.

History compaction stores summaries in `captra_conversation_summaries`; original message rows remain unchanged. Each summary records its source message IDs, model, prompt version, timestamp, and covered sequence. Backups must include both tables so summarized model context remains reproducible and auditable.

Conversation lifecycle operations are available through the store and authenticated HTTP client:

```ts
await runtime.conversations.archive(conversationId, identity)
await runtime.conversations.restore(conversationId, identity)
await runtime.conversations.delete(conversationId, identity)

// Run from a scheduled maintenance worker, one tenant at a time.
await conversations.purgeArchived(tenantId, Date.now() - 90 * 86_400_000, 1_000)
```

Conversations also support titles, labels, owner/editor/viewer roles, listing, and ownership transfer. Owners control sharing, lifecycle state, transfer, and deletion; editors can append and update metadata; viewers have read-only access. `migrateCaptra()` adds the metadata columns and tenant-scoped membership table safely to existing installations.

`purgeArchived()` deletes only archived conversations older than the cutoff, uses bounded batches, and relies on cascading foreign keys to remove their messages. Back up the database before changing retention policy, run `migrateCaptra()` as a deployment migration, and monitor deleted row counts. PostgreSQL point-in-time recovery or regular `pg_dump` backups should cover the Captra schema; test restoration before enabling automated retention.

[PostgreSQL documentation](https://vaibhavbansal26.github.io/captra/integrations) · [GitHub](https://github.com/VaibhavBansal26/captra/tree/main/packages/postgres) · MIT
