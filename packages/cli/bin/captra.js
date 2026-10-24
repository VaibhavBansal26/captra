#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const [, , command='help', argument] = process.argv
const root=resolve(argument??'.')
const templateRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../templates/fullstack')

if(command==='create'||command==='init') createProject(root)
else if(command==='dev') run('npm',['run','dev'],root)
else if(command==='build') run('npm',['run','build'],root)
else if(command==='test') run('npm',['test'],root)
else if(command==='inspect') inspect(root)
else help()

function createProject(directory){
  if(existsSync(directory)) fail(`Target already exists: ${directory}`)
  const projectName=packageName(basename(directory))
  copyTemplate(templateRoot,directory,{'{{projectName}}':projectName,'{{appName}}':title(projectName)})
  console.log(`\n  Captra app created at ${directory}\n\n  cd ${basename(directory)}\n  npm install\n  npm run dev\n`)
}

function inspect(directory){
  const fullStack=existsSync(resolve(directory,'src/server.ts'))||existsSync(resolve(directory,'src/client.ts'))
  const required=['package.json','src/captra.app.ts','src/capabilities',...(fullStack?['src/server.ts','src/client.ts']:[])]
  console.log(`\nCaptra project: ${directory}`)
  for(const item of required)console.log(`${existsSync(resolve(directory,item))?'✓':'×'} ${item}`)
  const pkgPath=resolve(directory,'package.json')
  if(existsSync(pkgPath)){const pkg=JSON.parse(readFileSync(pkgPath,'utf8'));const deps={...pkg.dependencies,...pkg.devDependencies};for(const name of ['@captra/core','@captra/react',...(fullStack?['@captra/client','@captra/server']:[])])console.log(`${deps[name]?'✓':'×'} ${name}${deps[name]?` ${deps[name]}`:''}`)}
  console.log('')
}
function copyTemplate(source,destination,replacements){for(const entry of readdirSync(source)){const from=resolve(source,entry),to=resolve(destination,entry),stats=statSync(from);if(stats.isDirectory()){mkdirSync(to,{recursive:true});copyTemplate(from,to,replacements)}else{mkdirSync(dirname(to),{recursive:true});let content=readFileSync(from,'utf8');for(const [token,value] of Object.entries(replacements))content=content.replaceAll(token,value);writeFileSync(to,content)}}}
function packageName(value){return value.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'captra-app'}
function title(value){return value.split(/[-_.]+/).filter(Boolean).map(word=>word[0].toUpperCase()+word.slice(1)).join(' ')}
function run(binary,args,cwd){const result=spawnSync(binary,args,{cwd,stdio:'inherit',shell:process.platform==='win32'});process.exit(result.status??1)}
function fail(message){console.error(message);process.exit(1)}
function help(){console.log(`\nCaptra — the capability-first AI application framework\n\n  captra create <directory>\n  captra dev [directory]\n  captra build [directory]\n  captra test [directory]\n  captra inspect [directory]\n`)}
