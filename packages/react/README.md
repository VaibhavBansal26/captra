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

[React documentation](https://vaibhavbansal26.github.io/captra/reference/react) · [GitHub](https://github.com/VaibhavBansal26/captra/tree/main/packages/react) · MIT
