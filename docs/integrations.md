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

The core runtime depends on interfaces rather than vendors. Custom infrastructure can implement model, memory, run, checkpoint, queue, state, planning, and telemetry contracts.

A model adapter should translate `ModelRequest.output` into its provider's native JSON Schema mode when available. The adapter must still return the textual JSON in `ModelResponse.text`; Captra owns normalization, Zod validation, bounded repair, and portable error semantics.

## Plugin compatibility

Plugin names must be unique. Tool conflicts fail during application construction, preventing load-order-dependent behavior. A plugin should declare its own version and document the compatible Captra range until a formal compatibility manifest is introduced.

## Planned official integrations

The next integration milestone prioritizes authentication, PostgreSQL platforms, observability, additional model providers, and common SaaS tools. See the [roadmap](/roadmap).
