---
'@captra-ai/core': minor
'@captra-ai/postgres': minor
'captra': patch
---

Add an explicit run-completion transaction contract and a PostgreSQL implementation that atomically commits durable assistant messages, usage, completion events, and terminal run state. Durable chat now stages deterministic message and usage records for replay-safe completion.
