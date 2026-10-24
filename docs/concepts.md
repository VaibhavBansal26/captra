# The Captra mental model

Captra uses a small set of terms consistently.

## Capability

A typed action the application can perform. A capability may be deterministic or backed by an agent, but it always has validated input and output and executes through the same runtime.

## Agent

A capability whose implementation is a bounded model/tool loop. An agent adds instructions, a model, tools, and step/token budgets without introducing a second application architecture.

## Tool

A reusable typed integration function. Tools declare schemas and permissions and are explicitly registered. Agents can choose tools; they cannot invent or silently replace them.

## Hook

Lifecycle middleware around memory, tools, approvals, events, and errors. Transform and policy hooks fail closed. Observer hooks are failure-isolated.

## Plugin

A versioned bundle of tools and hooks. Plugins provide the extension boundary for databases, SaaS APIs, policy, and observability.

## App

The registry and deployment boundary containing capabilities, tools, plugins, scopes, hooks, and UI surface metadata.

## Runtime

The execution engine. It validates contracts, authorizes permissions, recalls memory, coordinates tools, pauses for approval, emits events, persists runs, and handles cancellation and recovery.

## View

A transport-safe component name resolved against an explicit local UI registry. The server chooses an allowed view identifier; the client owns the actual component implementation.
