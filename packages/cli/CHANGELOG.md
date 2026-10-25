# @captra-ai/cli

## 0.7.3

### Patch Changes

- Updated dependencies [2aa8cbd]
  - @captra-ai/core@0.15.0

## 0.7.2

### Patch Changes

- Updated dependencies [59451c5]
  - @captra-ai/core@0.14.0

## 0.7.1

### Patch Changes

- Updated dependencies
  - @captra-ai/core@0.13.0

## 0.7.0

### Minor Changes

- Complete the evaluation workflow with portable JSON and JSONL datasets, schema-constrained model judge scorers, repeated-run confidence intervals, a TypeScript-aware `captra eval` command, and GitHub Actions annotations.

### Patch Changes

- Updated dependencies
  - @captra-ai/core@0.12.0

## 0.6.1

### Patch Changes

- Generate new applications against Captra 0.10 with provider fallback and aggregate usage accounting.

## 0.6.0

### Minor Changes

- Add `captra secrets`, a build-time security gate that follows browser runtime imports, rejects server-only modules and environment access, detects credential-like literals without printing their values, checks public environment variables, and can scan compiled output with `--dist`.

  Generated applications now run the gate before and after their browser build and keep UI components separate from server-side capability and provider configuration.

## 0.5.5

### Patch Changes

- Generate new applications against the secure-by-default Captra 0.9 runtime.

## 0.5.4

### Patch Changes

- Move the generated full-stack starter to the Captra 0.8 compatibility line.

## 0.5.3

### Patch Changes

- Add package-specific npm READMEs with installation, usage, security notes, documentation links, and repository links. Package and public-release checks now fail when README content is missing.

## 0.5.2

### Patch Changes

- Update the full-stack starter to install the Captra 0.7 release line.

## 0.5.1

### Patch Changes

- Generate starters against Captra 0.6 so new projects receive reservation-based budget enforcement.

## 0.5.0

### Minor Changes

- Add the first Captra 0.5 developer-preview slice: authenticated request rate limiting, the `captra/devtools` run inspector, and a generated Hello AI World agent with demo and OpenAI modes.

## 0.4.0

### Minor Changes

- Update the full-stack starter to Captra 0.4 with shared multi-agent state.

## 0.3.0

### Minor Changes

- Update the full-stack starter to Captra 0.3 with the new typed state layer.

## 0.2.1

### Patch Changes

- Update the full-stack starter to install the released Captra 0.2 line so newly generated applications install successfully from the public npm registry.

## 0.2.0

### Minor Changes

- 09ce055: Prepare the first compiled Captra framework release with an approved brand system and startup animation, a tested full-stack starter, framework-aware CLI generators and diagnostics, accessible headless UI primitives, typed remote React lifecycle and streaming, composable governance hooks, a versioned third-party plugin contract, agent capabilities, durable execution, adaptive memory, provider integrations, real PostgreSQL and pgvector integration coverage, end-to-end typed HTTP contracts, official Next.js, Hono, Express, and Node backend mounts, transport-safe results, observability, and evaluations.
