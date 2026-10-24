import { mkdtempSync,readFileSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join,resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repository=resolve(import.meta.dirname,'..'),temporary=mkdtempSync(join(repository,'.captra-scaffold-')),project=join(temporary,'My Starter')
try{
  run(process.execPath,[join(repository,'packages/cli/bin/captra.js'),'create',project],repository)
  const manifest=JSON.parse(readFileSync(join(project,'package.json'),'utf8'))
  if(manifest.name!=='my-starter')throw new Error(`Unexpected scaffold package name: ${manifest.name}`)
  for(const dependency of ['@captra/core','@captra/client','@captra/react','@captra/server'])if(!manifest.dependencies[dependency])throw new Error(`Scaffold is missing ${dependency}`)
  run('npm',['run','build'],project)
  run('npm',['test'],project)
  console.log('✓ create-captra full-stack scaffold builds and tests')
}finally{rmSync(temporary,{recursive:true,force:true})}

function run(command,args,cwd){const result=spawnSync(command,args,{cwd,stdio:'pipe',encoding:'utf8'});if(result.status!==0)throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`)}
