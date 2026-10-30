# Model providers

Captra’s `ModelAdapter` keeps capability and agent code provider-neutral. Official adapters currently cover OpenAI, Anthropic, and Google Gemini.

## Configure a provider

Provider adapters belong in trusted server code. Each adapter reads its conventional environment variable when `apiKey` is omitted.

```ts
import { createOpenAI } from 'captra/openai'
import { createAnthropic } from 'captra/anthropic'
import { createGemini } from 'captra/gemini'

const openai=createOpenAI({model:process.env.OPENAI_MODEL??'gpt-5-mini'})
const anthropic=createAnthropic({model:process.env.ANTHROPIC_MODEL??'claude-sonnet-5'})
const gemini=createGemini({model:process.env.GEMINI_MODEL??'gemini-3.8-flash'})
```

Use `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GEMINI_API_KEY`. Gemini also accepts `GOOGLE_API_KEY`. Never prefix these names with `VITE_`, `NEXT_PUBLIC_`, `PUBLIC_`, or `REACT_APP_`; `captra secrets` fails browser builds that expose them.

The full-stack starter selects the first configured provider. Set `CAPTRA_MODEL_PROVIDER` to `openai`, `anthropic`, or `gemini` when multiple keys exist.

## Shared behavior

All three adapters support:

- text generation and typed token-stream events;
- Captra tool declarations and provider tool-call normalization;
- provider-native JSON Schema output;
- input, output, cached, and reasoning token accounting when reported;
- `AbortSignal` cancellation;
- bounded transient retries;
- `ModelProviderError` with provider, HTTP status, stable code, and retryability.

Captra still parses and validates structured text with the application’s Zod schema. One bounded repair attempt protects against unsupported schema constraints or provider regressions.

## Fallback chains

```ts
import { createModelFallback } from 'captra'

const model=createModelFallback([
  {name:'openai',model:openai,retries:1,timeoutMs:15_000},
  {name:'anthropic',model:anthropic,retries:1,timeoutMs:20_000},
  {name:'gemini',model:gemini,timeoutMs:20_000},
],{
  maxElapsedMs:45_000,
  circuitBreaker:{failureThreshold:3,cooldownMs:60_000},
})
```

Authentication, invalid requests, and cancellation are terminal. Rate limits and transient server failures can retry or move to the next provider. Attempt-level usage remains visible in traces and is included in run budget accounting.

## API mappings

`@captra-ai/anthropic` uses the Messages API, top-level system instructions, strict `input_schema` tools, `output_config.format` for structured output, and SSE content block deltas.

`@captra-ai/gemini` uses GenerateContent, system instructions, function declarations and responses, `responseJsonSchema`, and the SSE streaming endpoint. The adapter remains stateless and sends the Captra agent’s normalized conversation on each model turn.
