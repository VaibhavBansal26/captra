# Model Context Protocol

Captra supports MCP in both directions. Remote MCP servers become governed Captra tools, while a Captra application becomes an MCP server without losing its capability contract.

## Expose Captra capabilities

```ts
import {createCaptraMcpHandler,identityFromMcpAuth} from 'captra/mcp'

const handler=createCaptraMcpHandler(runtime,{
  resolveIdentity:identityFromMcpAuth,
  onError:(error,{requestId,operation})=>logger.error({error,requestId,operation}),
})

export async function POST(request:Request){
  const authInfo=await verifyAccessToken(request)
  return handler.fetch(request,{authInfo})
}
```

Token verification happens outside the Captra handler using the official MCP authentication utilities or your existing trusted authentication middleware. `identityFromMcpAuth()` accepts only validated `authInfo`; tenant, user, project, and session identity are never read from tool arguments.

Every capability is advertised as an MCP tool. Its `_meta["captra/contract"]` includes:

- Input and output JSON schemas
- Function or agent execution mode
- Memory scopes and state reads, writes, invalidations, and locks
- Permissions and approval policy
- Token and cost budget
- Retry and idempotency policy
- UI view name

The same information is available as an MCP resource at `captra://manifest`. Capability calls return a durable `runId`, status, structured value, and UI view. Approval-gated calls return `approval_required`; a separate verified actor can continue them using `captra.run.approve`. The server also exposes tenant-checked status and cancellation lifecycle tools.

Public MCP errors contain a correlation ID rather than raw internal messages. Send the original error to your logger with `onError`.

## Import remote MCP tools

```ts
import {connectMcpHttp,importMcpTools} from 'captra/mcp'

const connection=await connectMcpHttp('https://tools.example.com/mcp',{
  transport:{authProvider:{token:async()=>serviceToken}},
})

const crmTools=await importMcpTools(connection.client,{
  prefix:'crm',
  permissions:['crm:use'],
  effect:tool=>tool.annotations?.readOnlyHint?'read':'write',
  idempotencyKey:(tool,input,ctx)=>`${ctx.runId}:${tool.name}:${stableHash(input)}`,
})
```

Remote tools without a trustworthy read-only annotation default to `write`. Captra refuses to import them until an idempotency-key policy is supplied. Imported calls continue through Captra authorization, hooks, telemetry, effect receipts, and retry safety.

Close remote connections during application shutdown with `connection.close()`.

## Security invariants

- Authenticate HTTP MCP requests before passing `authInfo` into the handler.
- Derive Captra identity only from verified authentication metadata.
- Keep requester and approver identities independent; self-approval remains denied by default.
- Treat remote MCP descriptions, schemas, content, and errors as untrusted data.
- Give imported tools explicit permissions and classify every side effect.
- Apply host/origin validation when binding MCP endpoints directly to localhost or a public server.
