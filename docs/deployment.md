# Backend and deployment

Captra's primary server handler accepts Web Standard `Request` objects and returns `Response` objects. This keeps the application contract independent of a hosting vendor.

## Supported mounting styles

- Web Standard runtimes
- Next.js route handlers
- Hono and Cloudflare Workers
- Node HTTP servers
- Express-compatible servers

## Production boundary

Configure authentication, CORS, request limits, authorization, durable stores, and telemetry at runtime creation or handler creation. Model credentials belong only in trusted server code.

## Durable execution

Use `@captra-ai/postgres` for tenant-scoped conversations, memory, runs, ordered events, checkpoints, idempotency, work queues, semantic memory, and shared state. Run migrations during deployment rather than in every request process.

Background workers claim expiring queue leases. Checkpoints allow a replacement worker to resume without repeating completed tool calls.

## Deployment checklist

- Resolve a trusted identity for every request
- Enforce tool and capability permissions server-side
- Allowlist exact outbound origins for every HTTP tool
- Configure explicit CORS origins
- Apply request-size and execution budgets
- Use durable conversation, run, checkpoint, and queue stores
- Run PostgreSQL migrations before traffic shifts
- Back up and restore-test the Captra schema before enabling archived-conversation retention
- Run retention in bounded, tenant-scoped maintenance batches and monitor deleted row counts
- Export telemetry and alert on failures and lease conflicts
- Log original server failures through `onError` with their request IDs
- Test cancellation and worker recovery
- Never expose provider or database secrets to client bundles
