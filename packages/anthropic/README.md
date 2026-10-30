# @captra-ai/anthropic

Official Anthropic Messages API adapter for Captra. It supports text generation, token streaming, strict tools, native JSON Schema output, usage accounting, cancellation, retries, and portable provider errors.

```ts
import { createAnthropic } from '@captra-ai/anthropic'

const model=createAnthropic({
  model:process.env.ANTHROPIC_MODEL ?? 'claude-sonnet-4-6',
  apiKey:process.env.ANTHROPIC_API_KEY,
})
```

The adapter is server-only. Never expose `ANTHROPIC_API_KEY` to browser code.
