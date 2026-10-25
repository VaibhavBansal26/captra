# Captra Devtools

`@captra-ai/devtools` turns durable replay data into an inspectable developer surface.

```tsx
import { CaptraDevtools, CaptraEvaluations, CaptraUsage } from 'captra/devtools'

const replay=await client.replay(runId)
<CaptraDevtools replay={replay}/>
<CaptraUsage groupBy="provider" items={usage.items}/>
<CaptraEvaluations reports={evaluationHistory}/>
```

The unstyled component displays run status, duration, agent steps, tool calls, actual versus reserved tokens, reported cost, recalled-memory count, checkpoints, ordered events, and validated input/output. Stable `data-captra-devtools` attributes let applications supply their own visual system.

Use `inspectRun(replay)` without React to calculate the same summary for tests, logs, or custom interfaces.

Run inspection includes provider attempts, failures, tokens, cost, and latency. `CaptraUsage` renders durable summaries returned by `client.usage()`.

Devtools only renders data supplied to it. Production applications should protect replay and usage routes with identity boundaries. Captra's server adapter uses run ownership and user-scoped usage by default; tenant-wide usage requires an explicit authorization callback.
