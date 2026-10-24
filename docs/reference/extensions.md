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

Captra includes memory tools and a JSON HTTP tool in `builtinTools`. Register only the tools the application intends to expose.

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
