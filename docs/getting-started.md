# Getting started

## Requirements

- Node.js 20 or newer
- npm 10 or newer

## Create an application

```bash
npx create-captra my-app
cd my-app
npm install
npm run dev
```

The generated application contains a Vite/React client, a Node server, a typed capability, scoped memory, a component registry, and tests.

## Define a capability

```tsx
import { capability } from 'captra'
import { z } from 'zod'

export const greet=capability({
  name:'greet',
  input:z.object({name:z.string().min(1)}),
  output:z.object({message:z.string()}),
  run:async ({name})=>({message:`Hello, ${name}.`}),
  view:'GreetingCard',
})
```

A capability is the unit of product behavior. Its name, schemas, permissions, memory, state effects, approval policy, implementation, and view form one inspectable contract.

## Register the application

```ts
import { defineApp } from 'captra'
import { greet } from './capabilities/greet.js'

export const app=defineApp({
  name:'My application',
  scopes:['user','project'],
  capabilities:[greet],
})
```

## Call it from React

```tsx
const greet=useRemoteCapability(client,'greet')
await greet.run({name:'Ada'})

return <CapabilityBoundary result={greet.result} pending={greet.pending} error={greet.error} views={{GreetingCard}} />
```

The client infers the capability name, input, and output from the app contract. Views remain local React components; runtime functions are never serialized over the network.

## Validate the project

```bash
npx captra doctor
npm test
npm run build
```
