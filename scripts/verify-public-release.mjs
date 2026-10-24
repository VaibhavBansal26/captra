import { mkdtempSync,readdirSync,readFileSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join,resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repository=resolve(import.meta.dirname,'..')
const generator=JSON.parse(readFileSync(join(repository,'packages/create-captra/package.json'),'utf8'))
const packages=discoverPackages()
const temporary=mkdtempSync(join(tmpdir(),'captra-public-release-'))
const project=join(temporary,'public-smoke')
const cache=join(temporary,'npm-cache')

try{
  await verifyPublishedPackages()
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

function discoverPackages(){
  return readdirSync(join(repository,'packages'),{withFileTypes:true})
    .filter(entry=>entry.isDirectory())
    .map(entry=>JSON.parse(readFileSync(join(repository,'packages',entry.name,'package.json'),'utf8')))
    .filter(manifest=>!manifest.private)
    .map(({name,version})=>({name,version}))
}

async function verifyPublishedPackages(){
  const pending=new Map(packages.map(manifest=>[manifest.name,manifest]))
  let lastFailures=[]
  for(let attempt=1;attempt<=12&&pending.size>0;attempt++){
    lastFailures=[]
    for(const [name,manifest] of pending){
      const specifier=`${name}@${manifest.version}`
      const result=spawnSync('npm',['view',specifier,'version','--json'],{encoding:'utf8'})
      const published=result.status===0?JSON.parse(result.stdout.trim()):undefined
      if(published===manifest.version){
        console.log(`✓ public ${specifier}`)
        pending.delete(name)
      }else lastFailures.push(`${specifier}: ${result.stderr.trim()||`received ${String(published)}`}`)
    }
    if(pending.size>0&&attempt<12){
      console.log(`npm registry is still propagating ${pending.size} package(s); retrying (${attempt}/12)`)
      await delay(15_000)
    }
  }
  if(pending.size>0)throw new Error(`Public packages were unavailable after propagation retries:\n${lastFailures.join('\n')}`)
}
