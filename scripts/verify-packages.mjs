import { spawnSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const packages=['@captra/core','@captra/client','@captra/server','@captra/react','@captra/postgres','@captra/openai']
const executables=['@captra/cli','create-captra']
const allPackages=[...packages,...executables]
for(const name of allPackages){
  const directory=name==='create-captra'?'create-captra':name.split('/')[1]
  const manifest=JSON.parse(await readFile(join('packages',directory,'package.json'),'utf8'))
  for(const field of ['description','license','repository'])if(!manifest[field])throw new Error(`${name} is missing package metadata: ${field}`)
}
for(const name of packages){const module=await import(name);if(!Object.keys(module).length)throw new Error(`${name} has no public exports`);console.log(`✓ import ${name}`)}
const cache=join(tmpdir(),`captra-pack-${process.pid}`)
for(const name of packages){const result=spawnSync('npm',['pack','--dry-run','--json','--workspace',name],{stdio:'pipe',encoding:'utf8',env:{...process.env,npm_config_cache:cache}});if(result.status!==0)throw new Error(result.stderr||`Could not pack ${name}`);const report=JSON.parse(result.stdout)[0];if(!report.files.some(file=>file.path.endsWith('.d.ts')))throw new Error(`${name} package is missing declarations`);if(report.files.some(file=>file.path.includes('/src/')))throw new Error(`${name} package leaks source files`);console.log(`✓ pack ${name} (${report.files.length} files)`)}
for(const name of executables){const result=spawnSync('npm',['pack','--dry-run','--json','--workspace',name],{stdio:'pipe',encoding:'utf8',env:{...process.env,npm_config_cache:cache}});if(result.status!==0)throw new Error(result.stderr||`Could not pack ${name}`);const report=JSON.parse(result.stdout)[0];const executable=report.files.find(file=>file.path.startsWith('bin/'));if(!executable)throw new Error(`${name} package is missing its executable`);if((executable.mode&0o111)===0)throw new Error(`${name} executable is not marked executable`);console.log(`✓ pack ${name} (${report.files.length} files)`)}
