# Runtime and durability

`createRuntime(app, options)` compiles an app contract into the execution engine.

## Execution lifecycle

1. Validate input and resolve identity.
2. Authorize capability permissions.
3. Recall allowed memory.
4. Execute deterministic code or the bounded agent loop.
5. Validate tool calls and structured output.
6. Pause for approval when required.
7. Persist events, checkpoints, and the final result.
8. Apply declared state invalidation.

## Durable stores

Development defaults can run in memory. Production deployments should configure durable implementations for runs, memory, checkpoints, and work queues. `@captra-ai/postgres` supplies each of these.

## Checkpoint recovery

Agents checkpoint before and after each tool call. A replacement worker restores messages, provider continuation state, budget counters, and the pending call index. Completed tools are not repeated.

## Events and replay

Every run has an ordered trace. `runtime.replay(runId)` returns the durable run, events, and checkpoint history. Use model recording and replay to make evaluation suites deterministic without repeating provider calls.

## Evaluation and telemetry

`runEvaluation()` runs test cases through a runtime. `enforceEvaluation()` turns quality thresholds into a CI gate. `InMemoryTelemetry` supports local inspection; `createOpenTelemetryAdapter()` exports runtime, model, and tool signals to an existing OpenTelemetry setup.
