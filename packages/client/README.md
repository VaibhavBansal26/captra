# @captra-ai/client

Typed HTTP, SSE streaming, approvals, cancellation, event retrieval, and replay for a remote Captra runtime.

```bash
npm install @captra-ai/client @captra-ai/core
```

```ts
import { createCaptraClient } from '@captra-ai/client'
import type app from './captra.app'

const client = createCaptraClient<typeof app>({ baseUrl: '/api/captra' })
const result = await client.execute('greet', { name: 'Ada' })
```

Capability names, inputs, and outputs are inferred from the server's app contract. Use `stream()` when you need trace or `chat.delta` events before the final structured result. Its fourth argument accepts an `AbortSignal` for per-request cancellation.

[Client documentation](https://vaibhavbansal26.github.io/captra/reference/packages) · [GitHub](https://github.com/VaibhavBansal26/captra/tree/main/packages/client) · MIT
