# React and generated UI

Captra keeps component implementations in the browser. A remote result carries only an allowed view name and structured data.

## Remote execution hook

```tsx
const refund=useRemoteCapability(client,'refund')
await refund.stream({amount:48})
```

The hook exposes `result`, `events`, `pending`, and `error`, plus `approve()`, `reject()`, `cancel()`, `refreshEvents()`, and `reset()`.

## Safe view resolution

```tsx
<CapabilityOutput result={result} views={{RefundCard}} />
```

Unknown view names do not dynamically import code. The explicit registry is the security and customization boundary.

## UI primitives

- `CapabilityBoundary` handles pending, error, approval, output, and optional trace states.
- `RunStatus` renders the current durable run status.
- `ApprovalPanel` exposes accessible approval controls.
- `EventTimeline` renders ordered run events.

The primitives are intentionally unstyled and expose stable `data-captra` attributes.

## State hooks

`CaptraStateProvider` scopes a state instance. `useCaptraState()` handles loading, subscriptions, deduplication, errors, and refresh. `useOptimisticState()` returns commit and rollback controls for immediate interfaces.
