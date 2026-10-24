# Security policy

Captra is a developer preview. Do not treat model output, recalled memory, tool input, or remote component metadata as trusted data.

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability reporting for this repository. Include the affected package and version, reproduction, impact, and any suggested mitigation. Never include real credentials or customer data.

## Application security model

- Authentication resolves identity; authorization separately checks every capability and tool permission.
- Tenant and user identity come from trusted server code, never capability input or model output.
- Memory recall is scoped by tenant and owner before relevance ranking.
- UI results contain a view name, not executable code; clients resolve it through an explicit component registry.
- Model inference does not hold database locks. Shared writes use versions or short fenced leases.
- Agent steps, tool calls, tokens, request bodies, and request rates require explicit limits.
- Secrets remain in server-only provider clients and must not use browser-exposed environment prefixes.

## Prompt-injection boundary

Models may suggest tool calls, but Captra validates the tool name and schema, enforces permissions, applies hooks, and records the call before execution. Applications remain responsible for minimizing tool authority, separating read and write tools, requiring approval for irreversible actions, validating remote content, and preventing secrets from entering prompts.

## Supported versions

Until 1.0, security fixes target the latest published minor line. Upgrade guidance will accompany breaking security changes.
