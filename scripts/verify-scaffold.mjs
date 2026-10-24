import { mkdtempSync,readFileSync,rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join,resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repository=resolve(import.meta.dirname,'..'),temporary=mkdtempSync(join(repository,'.captra-scaffold-')),project=join(temporary,'My Starter')
try{
  run(process.execPath,[join(repository,'packages/cli/bin/captra.js'),'create',project],repository)
  const manifest=JSON.parse(readFileSync(join(project,'package.json'),'utf8'))
  if(manifest.name!=='my-starter')throw new Error(`Unexpected scaffold package name: ${manifest.name}`)
  if(!manifest.dependencies.captra)throw new Error('Scaffold is missing the captra framework package')
  for(const file of ['src/captra.app.ts','src/client.ts','src/server.ts','src/App.tsx'])if(readFileSync(join(project,file),'utf8').includes('@captra/'))throw new Error(`${file} bypasses the captra umbrella package`)
  run(process.execPath,[join(repository,'packages/cli/bin/captra.js'),'doctor',project],repository)
  run(process.execPath,[join(repository,'packages/cli/bin/captra.js'),'add','capability','summarize-notes',project],repository)
  run(process.execPath,[join(repository,'packages/cli/bin/captra.js'),'add','tool','search-docs',project],repository)
  run(process.execPath,[join(repository,'packages/cli/bin/captra.js'),'add','plugin','audit-kit',project],repository)
  for(const file of ['src/capabilities/summarize-notes.tsx','src/tools/search-docs.ts','src/plugins/audit-kit.ts'])if(!exists(file))throw new Error(`CLI did not generate ${file}`)
  run('npm',['run','build'],project)
  run('npm',['test'],project)
  console.log('✓ create-captra full-stack scaffold builds and tests')
}finally{rmSync(temporary,{recursive:true,force:true})}

function run(command,args,cwd){const result=spawnSync(command,args,{cwd,stdio:'pipe',encoding:'utf8'});if(result.status!==0)throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`)}
function exists(file){try{readFileSync(join(project,file));return true}catch{return false}}
