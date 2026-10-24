# Capabilities and agents

Capabilities are Captra's unit of product behavior. An agent is a capability implemented by a bounded model/tool loop.

## Deterministic capability

```ts
const createTicket=capability({
  name:'tickets.create',
  input:CreateTicketInput,
  output:Ticket,
  permissions:['tickets:write'],
  state:{writes:[['tickets']]},
  run:async (input,ctx)=>ctx.tools.call('tickets.insert',input),
  view:'TicketCard',
})
```

The runtime validates input before execution and output before persistence or transport. Permissions, memory scopes, state effects, approvals, and view metadata remain visible to inspection tooling.

## Agent capability

```ts
const researcher=agent({
  name:'research',
  instructions:'Research carefully and cite evidence.',
  input:ResearchRequest,
  output:ResearchReport,
  model,
  tools:[searchDocs,fetchPage],
  budget:{
    maxSteps:6,
    maxToolCalls:10,
    maxTokens:20_000,
    maxOutputTokens:2_000,
    user:{tokens:100_000,windowMs:86_400_000},
  },
  view:'ResearchReport',
})
```

An agent receives the same runtime services as any capability. Its budgets limit model turns, tool calls, token usage, cost, and shared user or tenant quotas. Captra reserves capacity before inference and commits actual provider usage afterward. See [token and cost budgets](/reference/budgets).

## Structured generation

Use `createStructuredGenerator()` when a capability needs one schema-constrained model result without a multi-step agent loop. Use `createModelPlanner()` when natural language should select among registered capabilities.

## Human approval

Set `approval:'required'` for work that must pause before its effect is accepted. The run persists its waiting state and can resume through the client or React hook. The approver is recorded independently, must belong to the same tenant, and cannot be the requester by default. Use `approval:{required:true,allowRequester:true}` only for low-risk local workflows. Approval policy can be tightened with `authorizeApproval` and `beforeApproval` hooks.

Write tools must declare `effect:'write'` and an `idempotencyKey`. Captra stores an effect receipt before executing the write, reuses completed results on retry, and stops with `EffectInDoubtError` when a failed write may have reached the external system. Reconcile that receipt instead of blindly repeating the side effect.

## Design guidance

- Keep capability names stable and domain-oriented.
- Put irreversible external effects behind typed tools.
- Prefer deterministic code for rules and calculations.
- Use an agent where interpretation, planning, or tool selection is genuinely needed.
- Set budgets for every agent used in production.
