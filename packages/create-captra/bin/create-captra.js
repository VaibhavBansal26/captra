#!/usr/bin/env node
process.argv.splice(2,0,'create')
await import('@captra/cli/bin/captra.js')
