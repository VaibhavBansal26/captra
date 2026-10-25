# Command-line interface

The CLI supports the complete local workflow.

```bash
captra create my-app
captra add capability summarize-notes
captra add tool search-docs
captra add plugin audit-kit
captra doctor
captra eval captra.eval.ts --repetitions=5
captra dev my-app
captra build my-app
captra test my-app
captra inspect my-app
```

## `create`

Generates a full-stack Vite, React, and Node application with a capability, typed transport, local component registry, memory, and tests.

## `add`

Generates typed capability, tool, or plugin modules. The command prints the registration step instead of silently mutating application behavior.

## `doctor`

Checks Node, the Captra dependency, expected project structure, TypeScript configuration, and common browser-exposed secret mistakes. Secret values are never printed.

## `inspect`

Validates and summarizes a Captra project and its installed framework packages. Use it in CI to catch incomplete registrations and incompatible setup.

## `eval`

Loads a TypeScript or JavaScript evaluation config exporting `{runtime,suite,options?,thresholds?}`, runs the suite, and enforces its quality gates. Formats include Markdown, JSON, JUnit XML, and GitHub Actions annotations. In GitHub Actions, annotations are selected automatically.

```bash
captra eval                           # captra.eval.ts
captra eval evals/support.eval.ts --format=json --output=artifacts/eval.json
captra eval --repetitions=10
```

## `secrets`

```bash
captra secrets
captra secrets --dist
```

Follows browser runtime imports from `src/main.*` and `src/client.*` while ignoring type-only imports. It fails when browser-reachable code imports Captra's server, OpenAI, or PostgreSQL entry points, reads server environment variables, contains a recognizable credential literal, or declares a secret-looking public environment variable. Findings identify the file, line, and category but never print a credential value.

`--dist` scans compiled JavaScript, HTML, and CSS. The generated starter runs both checks as part of `npm run build`.

Projects with nonstandard entry points can configure the check in `package.json`:

```json
{
  "captra": {
    "security": {
      "secretCheck": {
        "browserEntries": ["web/main.tsx"],
        "outputDirectory": "build",
        "allowEnv": ["PUBLIC_ANALYTICS_TOKEN"],
        "ignoreFiles": ["dist/vendor/**"]
      }
    }
  }
}
```

Allowlist only values that are intentionally public. An allowlist suppresses a finding; it does not make a secret safe.
