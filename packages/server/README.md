# @captra-ai/server

Framework-neutral HTTP transport for Captra runtimes, including typed execution, SSE streaming, approvals, cancellation, replay, CORS, authentication, and rate limiting.

```bash
npm install @captra-ai/server @captra-ai/core
```

```ts
import { createCaptraHandler } from '@captra-ai/server'

const handler = createCaptraHandler(runtime, {
  auth: async request => authenticate(request),
})
```

Adapters are available from `@captra-ai/server/node` and `@captra-ai/server/express`. Keep provider keys and database credentials on the server.

[Server documentation](https://vaibhavbansal26.github.io/captra/deployment) · [GitHub](https://github.com/VaibhavBansal26/captra/tree/main/packages/server) · MIT
