# Contributing to Captra

Captra is currently an early framework preview. Bug reports, API feedback, adapters, tests, and focused documentation improvements are welcome.

## Development

```bash
npm install
npm test
npm run build
npm run inspect
```

Keep `@captra-ai/core` independent of React, model providers, databases, and server frameworks. Integration-specific behavior belongs in an adapter package.

Before proposing a public API change, describe the capability contract it improves and whether serialized runs remain backward compatible.
