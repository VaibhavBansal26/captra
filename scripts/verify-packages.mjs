import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const packages=['@captra-ai/core','@captra-ai/client','@captra-ai/server','@captra-ai/react','@captra-ai/postgres','@captra-ai/openai','captra']
const executables=['@captra-ai/cli','create-captra']
const allPackages=[...packages,...executables]
for(const name of allPackages){
  const directory=name.startsWith('@captra-ai/')?name.split('/')[1]:name
  const manifest=JSON.parse(await readFile(join('packages',directory,'package.json'),'utf8'))
  for(const field of ['description','license','repository'])if(!manifest[field])throw new Error(`${name} is missing package metadata: ${field}`)
}
for(const name of packages){const module=await import(name);if(!Object.keys(module).length)throw new Error(`${name} has no public exports`);console.log(`✓ import ${name}`)}
const nodeServer=await import('@captra-ai/server/node');if(typeof nodeServer.createNodeHandler!=='function')throw new Error('@captra-ai/server/node has no Node adapter');console.log('✓ import @captra-ai/server/node')
const expressServer=await import('@captra-ai/server/express');if(typeof expressServer.createExpressMiddleware!=='function')throw new Error('@captra-ai/server/express has no Express adapter');console.log('✓ import @captra-ai/server/express')
for(const path of ['captra/client','captra/react','captra/server','captra/server/node','captra/server/express','captra/postgres','captra/openai']){const module=await import(path);if(!Object.keys(module).length)throw new Error(`${path} has no public exports`);console.log(`✓ import ${path}`)}
const cache=join(tmpdir(),`captra-pack-${process.pid}`)
for(const name of packages){const result=spawnSync('npm',['pack','--dry-run','--json','--workspace',name],{stdio:'pipe',encoding:'utf8',env:{...process.env,npm_config_cache:cache}});if(result.status!==0)throw new Error(result.stderr||`Could not pack ${name}`);const report=JSON.parse(result.stdout)[0];if(!report.files.some(file=>file.path.endsWith('.d.ts')))throw new Error(`${name} package is missing declarations`);if(report.files.some(file=>file.path.includes('/src/')))throw new Error(`${name} package leaks source files`);console.log(`✓ pack ${name} (${report.files.length} files)`)}
for(const name of executables){const result=spawnSync('npm',['pack','--dry-run','--json','--workspace',name],{stdio:'pipe',encoding:'utf8',env:{...process.env,npm_config_cache:cache}});if(result.status!==0)throw new Error(result.stderr||`Could not pack ${name}`);const report=JSON.parse(result.stdout)[0];const executable=report.files.find(file=>file.path.startsWith('bin/'));if(!executable)throw new Error(`${name} package is missing its executable`);if((executable.mode&0o111)===0)throw new Error(`${name} executable is not marked executable`);console.log(`✓ pack ${name} (${report.files.length} files)`)}
