# State and memory

Captra keeps state and memory separate because they have different correctness requirements.

| | State | Memory |
| --- | --- | --- |
| Meaning | Current application truth | Historical context |
| Selection | Exact key | Relevance and scope |
| Consistency | Versions, invalidation, leases | Ranking, expiry, deduplication |
| Typical data | Inventory, tasks, balances | Preferences, prior decisions, conversation facts |

## Reactive state

Use `createState()` for typed live data, loading deduplication, subscriptions, invalidation, optimistic updates, hydration, and persistence. Capabilities declare reads, writes, invalidations, and locks in their contract.

## Shared agent state

Use `sharedState()` when multiple agents or workers update the same record. Normal writes use compare-and-swap versions. A conflict causes the agent to reread and replan.

Leases are bounded, short critical-section tools. Fencing tokens prevent an expired lease holder from writing after ownership changes. Do not hold a lease while waiting for model inference or an external API.

## Adaptive memory

Memory is tenant- and scope-aware. Adaptive recall ranks semantic candidates, excludes expired records, suppresses near duplicates, and injects only selected context. PostgreSQL with pgvector supports persistent similarity search across workers.

## Choosing a scope

- `organization`: shared institutional context
- `user`: durable user preferences and history
- `project`: context shared within one project
- `session`: one interaction period
- `task`: temporary context for one run or workflow

Authorization must be enforced before recall as well as before writes; similarity does not replace access control.
