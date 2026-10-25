# Chat capability

Chat is a Captra capability, not a separate endpoint or loosely connected UI helper. It therefore inherits typed contracts, scoped memory, approvals, per-run cancellation, budgets, usage accounting, tenant identity, replay, and MCP exposure.

## Define the capability

```ts
import { chat } from 'captra'
import { createOpenAI } from 'captra/openai'

export const supportChat = chat({
  name: 'support.chat',
  description: 'Answer customer support questions',
  instructions: 'Be accurate, concise, and never invent account data.',
  model: createOpenAI({ model: 'gpt-5-mini' }),
  memory: ['user', 'project'],
  budget: { maxTokens: 8_000, maxOutputTokens: 800 },
})
```

The built-in input contract is `{ messages, conversationId? }`. The output is `{ message, conversationId? }`. Providers with a `stream()` implementation emit `chat.delta` events. Providers without streaming still work through `generate()`.

Recalled memory is clearly marked as untrusted context before it reaches the model. The chat capability reserves token and cost capacity before inference, commits actual usage afterward, and releases the reservation when the provider fails.

## Use it from React

```tsx
import { useChat } from 'captra/react'

export function SupportChat() {
  const chat = useChat(client, 'support.chat')

  return <>
    {chat.messages.map(message => <p key={message.id}>{message.content}</p>)}
    <button onClick={() => chat.send('Where is my order?')}>Send</button>
    <button onClick={chat.stop} disabled={!chat.pending}>Stop</button>
  </>
}
```

`useChat` returns `messages`, `send`, `stop`, `reconnect`, `approve`, `reject`, `reset`, `run`, `status`, `approval`, `events`, `pending`, `error`, `draft`, `usage`, and `budget`.

Use `reconnect(runId)` after a reload or transport interruption. The hook reloads durable events, continues polling the run, deduplicates event IDs, and restores the final assistant message. `stop()` aborts the browser stream and cancels the active server run when its run ID is known.

## Security boundary

Chat history is capability input and must be treated as untrusted. Authentication stays in the server adapter. Provider keys must never be passed to `useChat` or included in the browser bundle.

Approval-required chat capabilities pause like every other Captra capability. The requester cannot self-approve by default; `approve()` must be called through a client authenticated as the independent approver.
