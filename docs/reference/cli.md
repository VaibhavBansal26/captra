# Command-line interface

The CLI supports the complete local workflow.

```bash
captra create my-app
captra add capability summarize-notes
captra add tool search-docs
captra add plugin audit-kit
captra doctor
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
