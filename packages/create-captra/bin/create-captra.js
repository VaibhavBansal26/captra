#!/usr/bin/env node
process.argv.splice(2,0,'create')
await import('@captra-ai/cli/bin/captra.js')
