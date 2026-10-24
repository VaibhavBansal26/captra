# Upgrade and migration guide

Captra is pre-1.0. Minor versions may introduce contract changes, but published migrations preserve serialized run safety whenever possible.

## Upgrade workflow

1. Upgrade Captra packages together when they share a milestone.
2. Run `captra doctor`.
3. Run application tests and TypeScript builds.
4. Apply PostgreSQL migrations before shifting traffic.
5. Verify replay of representative durable runs.
6. Roll out workers before or with API processes when queue formats change.

## 0.4 to 0.5

- Generated projects now start with `hello-ai`, a real bounded agent with demo and OpenAI modes.
- `captra/devtools` adds an unstyled run-inspection component and summary function.
- Server handlers can apply authenticated rate limits through `rateLimit`.
- Existing deterministic `hello` capabilities continue to work; rename only if adopting the new starter experience.

## Database migrations

`migrateCaptra()` and `migrateCaptraVectors()` are designed to run during deployment. Do not run schema migration on every application request. Back up production data and test migrations against a restored copy before rollout.
