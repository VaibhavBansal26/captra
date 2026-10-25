# Tools, hooks, and plugins

## Typed tools

```ts
const findCustomer=defineTool({
  name:'customers.find',
  description:'Find a customer by email.',
  input:z.object({email:z.email()}),
  output:Customer,
  permissions:['customers:read'],
  execute:({email})=>crm.customers.find(email),
})
```

Tools validate both sides of an integration. The runtime records calls and applies authorization before execution.

`builtinTools` contains only the scoped memory tools. Network access is opt-in and requires an explicit outbound policy:

```ts
const fetchBilling=createFetchJsonTool({
  allowedOrigins:['https://billing.example.com'],
  allowHeaders:['authorization'],
  maxResponseBytes:500_000,
})
```

The HTTP tool rejects non-allowlisted origins, URL credentials, unapproved headers, redirects, and oversized responses. Use a narrowly scoped instance for each external service.

## Lifecycle hooks

`defineHook()` supports policy, transformation, and observation around:

- memory recall
- tools
- approvals
- events
- capability errors
- tool errors

Before hooks run in registration order. After hooks unwind in reverse order. Policy and transformation hooks fail closed; observer failures are isolated and measured.

## Plugins

`definePlugin()` bundles tools and hooks into a versioned integration. Plugin names are unique, and conflicting tool registrations fail while building the app. This makes composition deterministic and inspectable.

```ts
const auditPlugin=definePlugin({
  name:'@acme/captra-audit',
  version:'1.0.0',
  hooks:[auditHook],
})
```

Keep credentials in server-side clients captured by tool closures. Never place secrets in plugin manifests or serialized capability metadata.
