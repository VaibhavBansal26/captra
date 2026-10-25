# @captra-ai/cli

The Captra developer CLI for creating, inspecting, developing, testing, and building capability-first applications.

```bash
npm install --save-dev @captra-ai/cli
npx captra inspect
npx captra secrets
npx captra dev
npx captra test
npx captra build
```

`captra secrets` follows the browser import graph and fails on server-only imports, server environment access, public secret variables, and recognizable credential literals without printing secret values. Use `captra secrets --dist` to inspect compiled browser assets.

Most new projects should start with `npx create-captra my-app`, which installs this CLI and generates the full-stack starter.

[CLI documentation](https://vaibhavbansal26.github.io/captra/getting-started) · [GitHub](https://github.com/VaibhavBansal26/captra/tree/main/packages/cli) · MIT
