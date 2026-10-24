---
layout: home

hero:
  name: Captra
  text: One contract for intelligent software.
  tagline: Build type-safe capabilities, agent loops, adaptive memory, shared state, tools, approvals, and UI without stitching together five frameworks.
  image:
    src: /captra-mark.svg
    alt: Captra
  actions:
    - theme: brand
      text: Start building
      link: /getting-started
    - theme: alt
      text: Understand the architecture
      link: /concepts
    - theme: alt
      text: View on GitHub
      link: https://github.com/VaibhavBansal26/captra

features:
  - title: Capability-first
    details: Deterministic functions and autonomous agents share one typed, inspectable contract.
  - title: State + memory
    details: Exact reactive state stays separate from scoped, semantic context—with safe coordination across agents.
  - title: Full-stack types
    details: The same schemas drive runtime validation, the remote client, structured output, and React rendering.
  - title: Durable agents
    details: Events, checkpoints, idempotency, queues, approvals, cancellation, and recovery are runtime primitives.
  - title: Integration-ready
    details: Typed tools, lifecycle hooks, versioned plugins, provider adapters, and Web Standard handlers.
  - title: Own the interface
    details: Accessible unstyled components and explicit view registries keep generated UI safe and customizable.
---

<section class="home-code">

## A complete product behavior in one contract

```tsx
export const refund=capability({
  name:'refund',
  input:RefundInput,
  output:RefundResult,
  memory:['user','project'],
  permissions:['refund:create'],
  approval:'required',
  run:refundPayment,
  view:RefundCard,
})
```

The contract tells Captra how to validate, authorize, execute, remember, observe, transport, and render the capability.

</section>

## Install

```bash
npx create-captra my-app
cd my-app
npm install
npm run dev
```

The starter includes a React client, Node runtime, typed transport, scoped memory, component registry, startup animation, and tests.

## What makes Captra different?

Many AI libraries help call a model. Captra defines the application boundary around the model: capabilities, exact state, recalled memory, authorized tools, human approvals, durable events, recovery, and UI. Those pieces remain replaceable, but they follow one mental model.

<div class="next-grid">
  <a href="./concepts"><strong>Learn the mental model →</strong><span>Capability, agent, tool, hook, plugin, app, runtime, and view.</span></a>
  <a href="./state-and-memory"><strong>Design state and memory →</strong><span>Choose the right consistency model for every kind of context.</span></a>
  <a href="./deployment"><strong>Deploy safely →</strong><span>Mount the runtime and configure durable production infrastructure.</span></a>
</div>
