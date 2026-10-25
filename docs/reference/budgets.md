# Token and cost budgets

Captra checks resources before each model call. It reserves the estimated prompt, the permitted output, and estimated cost; commits actual provider usage afterward; and releases unused capacity.

```ts
const support=agent({
  // ...schemas, model, and tools
  budget:{
    maxSteps:6,
    maxToolCalls:8,
    maxTokens:12_000,
    maxInputTokens:9_000,
    maxOutputTokens:1_500,
    maxCostUsd:0.08,
    user:{tokens:100_000,windowMs:86_400_000},
    tenant:{costUsd:250,windowMs:2_592_000_000},
    estimateCostUsd:(input,output)=>input*0.000001+output*0.000004,
  },
})
```

`maxOutputTokens` is forwarded to providers as a hard generation ceiling. `maxTokens` and `maxCostUsd` apply to the whole run. User and tenant quotas protect shared windows across concurrent runs.

## Reservation lifecycle

Captra emits `budget.checked`, `budget.reserved`, `budget.committed`, `budget.released`, and `budget.exceeded`. Devtools displays actual versus reserved tokens and reported cost.

`BudgetExceededError` identifies the failed scope, resource, limit, usage, requested reservation, and reset time. The model is not called when reservation fails.

## Production adapters

`InMemoryBudgetAdapter` is safe for concurrent work inside one JavaScript process. Multi-process and multi-region applications must provide a shared `BudgetAdapter` backed by a transactional store:

```ts
const runtime=createRuntime(app,{budgets:distributedBudgets})
```

The adapter must atomically validate and reserve every applicable scope. A database implementation should lock or compare-and-swap the user and tenant windows in one transaction so two workers cannot both consume the final allowance.

Provider usage remains the accounting source of truth. Supply provider-specific `estimateTokens` and `estimateCostUsd` functions when exact tokenizer and pricing behavior matters.

When `createModelFallback()` is used, usage from the successful response and any billed failed attempts is aggregated before the reservation is committed. Attempt-level usage remains available in model traces for provider-level reporting.
