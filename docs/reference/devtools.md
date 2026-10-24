# Captra Devtools

`@captra-ai/devtools` turns durable replay data into an inspectable developer surface.

```tsx
import { CaptraDevtools } from 'captra/devtools'

const replay=await client.replay(runId)
<CaptraDevtools replay={replay}/>
```

The unstyled component displays run status, duration, agent steps, tool calls, actual versus reserved tokens, reported cost, recalled-memory count, checkpoints, ordered events, and validated input/output. Stable `data-captra-devtools` attributes let applications supply their own visual system.

Use `inspectRun(replay)` without React to calculate the same summary for tests, logs, or custom interfaces.

Devtools only renders data supplied to it. Production applications should protect replay routes with the same tenant and user ownership checks as the run itself; Captra's server adapter does this by default.
