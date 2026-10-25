# @captra-ai/mcp

Bidirectional Model Context Protocol integration for Captra.

- Expose Captra capabilities as MCP tools with schemas and governance metadata
- Publish the complete application contract at `captra://manifest`
- Preserve approvals, identity, cancellation, durability, and tenant isolation
- Discover remote MCP tools and import them as permission-aware Captra tools
- Require explicit idempotency policy for remote write tools

```bash
npm install @captra-ai/mcp
```

```ts
import {createCaptraMcpHandler,identityFromMcpAuth} from '@captra-ai/mcp'

export const mcp=createCaptraMcpHandler(runtime,{resolveIdentity:identityFromMcpAuth})
export const POST=(request:Request)=>mcp.fetch(request,{authInfo:verifiedAuth})
```

Authentication must be verified before `authInfo` reaches the handler. Captra never derives tenant identity from tool arguments or untrusted request bodies.

[MCP documentation](https://vaibhavbansal26.github.io/captra/reference/mcp) · [GitHub](https://github.com/VaibhavBansal26/captra/tree/main/packages/mcp) · MIT
