# Integrations and plugins

An integration should expose typed tools and optional lifecycle hooks through `definePlugin()`.

```ts
export const crm=definePlugin({
  name:'@acme/captra-crm',
  version:'1.0.0',
  tools:[findCustomer,updateCustomer],
  hooks:[crmAudit],
})
```

## Integration rules

- Keep credentials inside server-side closures or environment-backed clients
- Validate tool input and output
- Declare permissions at the tool boundary
- Make write operations idempotent when possible
- Attach provider request IDs to telemetry without leaking secrets
- Use hooks for policy and observation, not hidden capability registration
- Document supported runtime environments

## Backend adapters

The core runtime depends on interfaces rather than vendors. Custom infrastructure can implement model, conversation, memory, run, checkpoint, queue, state, planning, and telemetry contracts.

For durable chat, configure `PostgresConversationStore` after applying `migrateCaptra()`:

```ts
const runtime=createRuntime(app,{
  conversations:new PostgresConversationStore(pool),
})
```

Conversation history is tenant-scoped, bound to its creating user, deduplicated by message ID, and read through backward cursor pages.

A model adapter should translate `ModelRequest.output` into its provider's native JSON Schema mode when available. The adapter must still return the textual JSON in `ModelResponse.text`; Captra owns normalization, Zod validation, bounded repair, and portable error semantics.

## Provider fallback

Compose provider-neutral adapters with deterministic fallback policy:

```ts
const model=createModelFallback([
  {name:'primary',model:openai,retries:1,timeoutMs:15_000,retryDelayMs:250},
  {name:'backup',model:anthropic,timeoutMs:20_000},
],{
  maxElapsedMs:30_000,
  circuitBreaker:{failureThreshold:3,cooldownMs:60_000},
})
```

Providers retry and fall back only for retryable failures. Invalid requests, authentication failures, cancellation, and other terminal errors stop immediately. The selected provider remains sticky across agent tool steps, while still being able to fail over later.

`ModelResponse.attempts` records provider, attempt number, status, duration, model, safe error code, and reported usage. Captra aggregates usage from billed failed attempts into the final response so token and cost budgets account for the entire fallback chain. Agent traces emit `model.provider.attempt` and `model.provider.fallback` events.

Adapters should throw `ModelProviderError` with HTTP status, retryability, a stable code, and any usage returned with the failure. Unknown transport errors are treated as retryable; explicitly invalid requests must be marked terminal.

## Plugin compatibility

Plugin names must be unique. Tool conflicts fail during application construction, preventing load-order-dependent behavior. A plugin should declare its own version and document the compatible Captra range until a formal compatibility manifest is introduced.

## Model Context Protocol

`captra/mcp` supports MCP in both directions. It can discover remote MCP tools and import them through Captra's permissions, hooks, effect receipts, and idempotency rules. It can also expose every Captra capability as an MCP tool while publishing the richer capability contract—memory, state, locks, approval, budget, policy, and UI metadata—as tool metadata and the `captra://manifest` resource.

See the [MCP reference](/reference/mcp) for authenticated HTTP setup and lifecycle handling.

## Planned official integrations

The next integration milestone prioritizes additional model providers, authentication adapters, PostgreSQL platforms, observability exporters, and common SaaS tools. See the [roadmap](/roadmap).
