# Security and tenant isolation

Captra treats the model as an untrusted planner operating inside typed, authorized boundaries.

## Identity and authorization

Resolve `tenantId`, `userId`, and `projectId` from a verified server session. Never accept these values from capability input. `authorize` checks capability and tool permissions independently.

## Tool safety

- Register the minimum set of tools.
- Separate read tools from tools with external effects.
- Make writes idempotent when possible.
- Require approval for irreversible or high-impact work.
- Validate tool output even when the provider API is trusted.
- Keep credentials in server-side closures.

## Prompt injection

Treat retrieved documents, webpages, tool output, and memory as data—not instructions with authority. Hooks can redact or reject tool input, but product-specific policy belongs in deterministic code.

## Resource limits

Every production agent should define step, tool-call, token, timeout, and retry budgets. The server supports request-size bounds and authenticated fixed-window rate limiting:

```ts
createCaptraHandler(runtime,{
  auth:resolveIdentity,
  maxBodyBytes:1_000_000,
  rateLimit:{limit:60,windowMs:60_000},
})
```

Use a distributed `RateLimitAdapter` when traffic spans multiple processes or regions.

## Tenant isolation

PostgreSQL adapters scope records by tenant and owner. Run routes verify ownership before returning status, events, replay data, approvals, or cancellation. Keep database credentials server-side and use separate environments for production and testing.

For vulnerability reporting, see the repository [security policy](https://github.com/VaibhavBansal26/captra/security/policy).
