# @captra-ai/gemini

Official Google Gemini GenerateContent adapter for Captra. It supports text generation, token streaming, function calling, native structured output, usage accounting, cancellation, retries, and portable provider errors.

```ts
import { createGemini } from '@captra-ai/gemini'

const model=createGemini({
  model:process.env.GEMINI_MODEL ?? 'gemini-3-flash-preview',
  apiKey:process.env.GEMINI_API_KEY,
})
```

The adapter is server-only. Never expose `GEMINI_API_KEY` to browser code.
