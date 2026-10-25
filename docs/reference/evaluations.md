# Replay and evaluations

Captra evaluations execute real capability contracts and measure correctness, quality, latency, tokens, and cost. Model recordings can replace live providers to make CI deterministic.

```ts
import {
  enforceEvaluation,
  formatEvaluation,
  runEvaluation,
  type EvaluationSuite,
} from 'captra'

const suite:EvaluationSuite={
  version:1,
  name:'Support quality',
  cases:[{
    name:'answers refund question',
    capability:'support.answer',
    input:{question:'Can I get a refund?'},
    identity:{tenantId:'ci',userId:'eval',projectId:'support'},
    assert:result=>result.run.status==='completed',
    scorers:[{
      name:'helpfulness',
      threshold:.8,
      score:result=>helpfulness(result.value),
    }],
    limits:{maxDurationMs:2_000,maxTokens:1_000,maxCostUsd:.02},
  }],
}

const report=await runEvaluation(runtime,suite,{variant:'candidate'})
enforceEvaluation(report,{
  minPassRate:.95,
  minScores:{helpfulness:.85},
  maxP95DurationMs:2_500,
  maxTokens:20_000,
  maxCostUsd:1,
})

console.log(formatEvaluation(report,'markdown'))
```

## Compare variants

Use separate runtimes to compare model, prompt, tool, or application configurations. The first variant is the default baseline.

```ts
const comparison=await compareEvaluations([
  {name:'gpt-5',runtime:baselineRuntime},
  {name:'candidate',runtime:candidateRuntime},
],suite)
```

The comparison reports pass-rate, duration, token, cost, and scorer deltas. It does not silently select a winner: applications decide which regression and improvement thresholds matter.

## Deterministic CI

Wrap a live adapter with `recordModel()` to capture provider-neutral requests and responses. Use `replayModel()` in CI so evaluations do not depend on network access, model drift, or API spend.

`formatEvaluation(report,'junit')` creates output understood by common CI test-report viewers. `enforceEvaluation()` throws `EvaluationRegressionError` with structured failure reasons and the original report.

Do not use the same model response as both the output under test and an LLM judge. Keep deterministic assertions and independent scorers for important safety or business requirements.

## Repeated runs and history

Repeat nondeterministic cases and save each completed report in a tenant-scoped history store:

```ts
const evaluations=new PostgresEvaluationStore(pool)

await runEvaluation(runtime,suite,{
  variant:'candidate',
  repetitions:5,
  store:evaluations,
  scope:{tenantId:'acme',projectId:'support'},
})

const history=await evaluations.list({
  tenantId:'acme',
  projectId:'support',
  suite:'Support quality',
  limit:20,
})
```

`InMemoryEvaluationStore` provides the same contract for local development. `CaptraEvaluations` from `captra/devtools` renders pass rate, average scores, tokens, cost, and P95 latency across stored reports.
