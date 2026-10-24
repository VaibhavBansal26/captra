import { mkdtempSync,readFileSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join,resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repository=resolve(import.meta.dirname,'..')
const generator=JSON.parse(readFileSync(join(repository,'packages/create-captra/package.json'),'utf8'))
const temporary=mkdtempSync(join(tmpdir(),'captra-public-release-'))
const project=join(temporary,'public-smoke')
const cache=join(temporary,'npm-cache')

try{
  let created=false,lastFailure=''
  for(let attempt=1;attempt<=12;attempt++){
    rmSync(project,{recursive:true,force:true})
    const result=spawnSync('npm',['create',`captra@${generator.version}`,'public-smoke','--yes','--cache',cache],{cwd:temporary,encoding:'utf8'})
    if(result.status===0){created=true;break}
    lastFailure=`${result.stdout}\n${result.stderr}`
    if(attempt<12){console.log(`npm registry is still propagating create-captra@${generator.version}; retrying (${attempt}/12)`);await delay(15_000)}
  }
  if(!created)throw new Error(`Public generator was unavailable after propagation retries:\n${lastFailure}`)
  run('npm',['install','--cache',cache],project)
  run('npm',['test'],project)
  run('npm',['run','build'],project)
  console.log(`✓ public create-captra@${generator.version} install, test, and build`)
}finally{rmSync(temporary,{recursive:true,force:true})}

function run(command,args,cwd){const result=spawnSync(command,args,{cwd,stdio:'inherit'});if(result.status!==0)throw new Error(`${command} ${args.join(' ')} failed with status ${result.status}`)}
function delay(milliseconds){return new Promise(resolveDelay=>setTimeout(resolveDelay,milliseconds))}
