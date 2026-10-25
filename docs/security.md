# Security and tenant isolation

Captra treats the model as an untrusted planner operating inside typed, authorized boundaries.

## Identity and authorization

Resolve `tenantId`, `userId`, and `projectId` from a verified server session. Never accept these values from capability input. `authorize` checks capability and tool permissions independently.

## Tool safety

- Register the minimum set of tools.
- Separate read tools from tools with external effects.
- Declare external writes with `effect:'write'` and a stable `idempotencyKey`; Captra blocks ambiguous retries with an effect receipt.
- Require approval for irreversible or high-impact work.
- Validate tool output even when the provider API is trusted.
- Keep credentials in server-side closures.
- Create HTTP tools with `createFetchJsonTool()` and exact `allowedOrigins`; network tools are not included in `builtinTools`.

## Prompt injection

Treat retrieved documents, webpages, tool output, and memory as data—not instructions with authority. Agent memory is sent as a delimited, untrusted user-context message rather than concatenated into the trusted system instruction. Hooks can redact or reject tool input, but product-specific policy belongs in deterministic code.

## Public errors

The server returns stable error codes, generic public messages, and an `x-request-id`. Original exceptions are available only through `onError` for trusted logging:

```ts
createCaptraHandler(runtime,{
  auth:resolveIdentity,
  onError:({requestId,error})=>logger.error({requestId,error}),
})
```

Run records, replay responses, events, and SSE streams also redact failure details at the transport boundary.

## Client-secret gate

Run `captra secrets` before a browser build and `captra secrets --dist` afterward. The generated starter does both automatically. The checker follows browser runtime imports, blocks server-only Captra entry points and server environment access, detects common credential shapes without echoing values, and checks public-prefixed variables in `.env` files.

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

PostgreSQL adapters scope records by tenant and owner. Run routes verify ownership before returning status, events, replay data, or cancellation. Approval routes require a same-tenant identity and the runtime denies requester self-approval by default. Keep database credentials server-side and use separate environments for production and testing.

For vulnerability reporting, see the repository [security policy](https://github.com/VaibhavBansal26/captra/security/policy).
