import { appendFileSync,mkdtempSync,readFileSync,rmSync,writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join,resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const repository=resolve(import.meta.dirname,'..'),temporary=mkdtempSync(join(repository,'.captra-scaffold-')),project=join(temporary,'My Starter')
try{
  run(process.execPath,[join(repository,'packages/cli/bin/captra.js'),'create',project],repository)
  const manifest=JSON.parse(readFileSync(join(project,'package.json'),'utf8'))
  const frameworkManifest=JSON.parse(readFileSync(join(repository,'packages/captra/package.json'),'utf8'))
  if(manifest.name!=='my-starter')throw new Error(`Unexpected scaffold package name: ${manifest.name}`)
  if(!manifest.dependencies.captra)throw new Error('Scaffold is missing the captra framework package')
  if(!satisfiesCaret(manifest.dependencies.captra,frameworkManifest.version))throw new Error(`Scaffold range ${manifest.dependencies.captra} does not include captra ${frameworkManifest.version}`)
  for(const file of ['src/captra.app.ts','src/client.ts','src/server.ts','src/App.tsx'])if(readFileSync(join(project,file),'utf8').includes('@captra-ai/'))throw new Error(`${file} bypasses the captra umbrella package`)
  run(process.execPath,[join(repository,'packages/cli/bin/captra.js'),'doctor',project],repository)
  run(process.execPath,[join(repository,'packages/cli/bin/captra.js'),'add','capability','summarize-notes',project],repository)
  run(process.execPath,[join(repository,'packages/cli/bin/captra.js'),'add','tool','search-docs',project],repository)
  run(process.execPath,[join(repository,'packages/cli/bin/captra.js'),'add','plugin','audit-kit',project],repository)
  for(const file of ['src/capabilities/summarize-notes.tsx','src/tools/search-docs.ts','src/plugins/audit-kit.ts'])if(!exists(file))throw new Error(`CLI did not generate ${file}`)
  run('npm',['run','build'],project)
  run('npm',['test'],project)
  const appPath=join(project,'src/App.tsx'),originalApp=readFileSync(appPath,'utf8'),fakeSecret='sk-proj-captraRegressionSecret123456789'
  appendFileSync(appPath,`\nconst leakedCredential='${fakeSecret}'\n`);expectBlocked('credential-like literal found',fakeSecret)
  writeFileSync(appPath,`${originalApp}\nimport 'captra/openai'\n`);expectBlocked('server-only import captra/openai')
  writeFileSync(appPath,`${originalApp}\nconst leakedEnv=process.env.OPENAI_API_KEY\n`);expectBlocked('browser-reachable environment access OPENAI_API_KEY')
  console.log('✓ create-captra full-stack scaffold builds and tests')
}finally{rmSync(temporary,{recursive:true,force:true})}

function run(command,args,cwd){const result=spawnSync(command,args,{cwd,stdio:'pipe',encoding:'utf8'});if(result.status!==0)throw new Error(`${command} ${args.join(' ')} failed\n${result.stdout}\n${result.stderr}`)}
function expectBlocked(message,hidden){const blocked=spawnSync(process.execPath,[join(repository,'packages/cli/bin/captra.js'),'secrets',project],{cwd:repository,stdio:'pipe',encoding:'utf8'});if(blocked.status===0)throw new Error(`Secret checker accepted: ${message}`);if(!blocked.stdout.includes(message)||hidden&&blocked.stdout.includes(hidden))throw new Error(`Secret checker did not report safely: ${message}`)}
function exists(file){try{readFileSync(join(project,file));return true}catch{return false}}
function satisfiesCaret(range,version){if(typeof range!=='string'||!range.startsWith('^'))return false;const minimum=parseVersion(range.slice(1)),candidate=parseVersion(version);if(!minimum||!candidate)return false;const compare=(left,right)=>left[0]-right[0]||left[1]-right[1]||left[2]-right[2],upper=minimum[0]>0?[minimum[0]+1,0,0]:minimum[1]>0?[0,minimum[1]+1,0]:[0,0,minimum[2]+1];return compare(candidate,minimum)>=0&&compare(candidate,upper)<0}
function parseVersion(value){const match=/^(\d+)\.(\d+)\.(\d+)$/.exec(value);return match?[Number(match[1]),Number(match[2]),Number(match[3])]:null}
