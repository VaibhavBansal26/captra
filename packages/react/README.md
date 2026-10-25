# @captra-ai/react

React hooks and accessible, unstyled UI primitives for Captra capabilities, remote runs, approvals, traces, and live application state.

```bash
npm install @captra-ai/react @captra-ai/core @captra-ai/state react
```

```tsx
import { CapabilityOutput, useRemoteCapability } from '@captra-ai/react'

const greet = useRemoteCapability(client, 'greet')
await greet.stream({ name: 'Ada' })

return <CapabilityOutput result={greet.result} views={{ Greeting }} />
```

Components expose stable `data-captra` attributes and remain fully styleable by the application.

For conversational interfaces, `useChat(client, 'support.chat')` provides messages, token deltas, stop, reconnect, streaming approvals, durable run status, usage, and budget state without introducing a second chat protocol. Render the accessible, unstyled default with `<CaptraChat chat={chat} />`, then customize it through render props and stable `data-captra` attributes.

For a capability declared with `durable:true`, pass `{durable:true, conversationId}` to `useChat`. The hook sends only the newest turn and exposes `loadMore()` plus `hasMore` for cursor pagination.

[React documentation](https://vaibhavbansal26.github.io/captra/reference/react) · [GitHub](https://github.com/VaibhavBansal26/captra/tree/main/packages/react) · MIT
