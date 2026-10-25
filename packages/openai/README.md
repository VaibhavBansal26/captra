# @captra-ai/openai

OpenAI Responses API and embeddings adapters for Captra's provider-neutral model and memory contracts.

HTTP failures are exposed as portable `ModelProviderError` values with status, retryability, stable codes, and reported usage so `createModelFallback()` can make deterministic decisions.

```bash
npm install @captra-ai/openai @captra-ai/core
```

```ts
import { createOpenAI, createOpenAIEmbeddings } from '@captra-ai/openai'

const model = createOpenAI({ model: 'gpt-5.4' })
const embeddings = createOpenAIEmbeddings({ model: 'text-embedding-3-small' })
```

The adapter supports strict native JSON Schema output, strict tool schemas, tool calls, response continuation, streaming, cancellation, usage accounting, and bounded retries. Create it only in trusted server code; never expose `OPENAI_API_KEY` to a browser bundle.

[Provider documentation](https://vaibhavbansal26.github.io/captra/integrations) · [GitHub](https://github.com/VaibhavBansal26/captra/tree/main/packages/openai) · MIT
