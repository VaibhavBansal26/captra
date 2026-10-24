#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const [, , command='help', ...arguments_] = process.argv
const argument=arguments_[0],root=resolve(argument??'.')
const templateRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../templates/fullstack')

if(command==='create'||command==='init') createProject(root)
else if(command==='dev') run('npm',['run','dev'],root)
else if(command==='build') run('npm',['run','build'],root)
else if(command==='test') run('npm',['test'],root)
else if(command==='inspect') inspect(root)
else if(command==='doctor') doctor(root)
else if(command==='add') add(arguments_[0],arguments_[1],resolve(arguments_[2]??'.'))
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
  if(existsSync(pkgPath)){const pkg=JSON.parse(readFileSync(pkgPath,'utf8'));const deps={...pkg.dependencies,...pkg.devDependencies},frameworks=deps.captra?['captra']:['@captra-ai/core','@captra-ai/react',...(fullStack?['@captra-ai/client','@captra-ai/server']:[])];for(const name of frameworks)console.log(`${deps[name]?'✓':'×'} ${name}${deps[name]?` ${deps[name]}`:''}`)}
  console.log('')
}
function doctor(directory){
  const findings=[]
  const check=(label,passed,help)=>{findings.push({label,passed,help});console.log(`${passed?'✓':'×'} ${label}${passed?'':` — ${help}`}`)}
  console.log(`\nCaptra doctor: ${directory}`)
  const major=Number(process.versions.node.split('.')[0]);check(`Node.js ${process.versions.node}`,major>=20,'install Node.js 20 or newer')
  const pkgPath=resolve(directory,'package.json'),hasPackage=existsSync(pkgPath);check('package.json',hasPackage,'run this command from a Captra project')
  let dependencies={};if(hasPackage){const pkg=JSON.parse(readFileSync(pkgPath,'utf8'));dependencies={...pkg.dependencies,...pkg.devDependencies}}
  check('Captra dependency',Boolean(dependencies.captra||dependencies['@captra-ai/core']),'install captra')
  check('Application contract',existsSync(resolve(directory,'src/captra.app.ts')),'create src/captra.app.ts')
  check('Capability directory',existsSync(resolve(directory,'src/capabilities')),'create src/capabilities')
  const configs=['tsconfig.json','tsconfig.app.json','tsconfig.server.json'].some(file=>existsSync(resolve(directory,file)));check('TypeScript configuration',configs,'add a tsconfig.json')
  const exposed=[];for(const file of ['.env','.env.local','.env.development','.env.production']){const path=resolve(directory,file);if(!existsSync(path))continue;for(const line of readFileSync(path,'utf8').split(/\r?\n/)){const name=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];if(name&&/^(VITE_|NEXT_PUBLIC_|PUBLIC_).*(OPENAI|ANTHROPIC|API_KEY|SECRET|TOKEN)/i.test(name))exposed.push(`${file}:${name}`)}}
  check('No browser-exposed AI secrets',exposed.length===0,exposed.length?`rename ${exposed.join(', ')} and keep it server-only`:'keep provider keys server-only')
  console.log(`\n${findings.every(item=>item.passed)?'Ready — no blocking issues found.':`${findings.filter(item=>!item.passed).length} issue(s) need attention.`}\n`)
  if(findings.some(item=>!item.passed))process.exitCode=1
}
function add(kind,name,directory){
  if(!['capability','tool','plugin'].includes(kind??''))fail('Usage: captra add <capability|tool|plugin> <name> [directory]')
  if(!name)fail(`A ${kind} name is required`)
  const slug=packageName(name),identifier=javascriptName(slug),templates={
    capability:{folder:'capabilities',extension:'tsx',content:`import { capability,type CapabilityViewProps } from 'captra'\nimport { z } from 'zod'\n\nconst ${identifier}Result=z.object({message:z.string()})\ntype ${identifier}Result=z.infer<typeof ${identifier}Result>\n\nexport function ${title(identifier)}Card({value}:CapabilityViewProps<${identifier}Result>){return <article><h2>{value.message}</h2></article>}\n${title(identifier)}Card.displayName='${title(identifier)}Card'\n\nexport const ${identifier}=capability({\n  name:'${slug}',description:'Describe what this capability does.',\n  input:z.object({prompt:z.string().min(1)}),output:${identifier}Result,\n  memory:['user'],approval:'never',\n  async run({prompt}){return {message:prompt}},\n  view:${title(identifier)}Card,\n})\n`},
    tool:{folder:'tools',extension:'ts',content:`import { defineTool } from 'captra'\nimport { z } from 'zod'\n\nexport const ${identifier}=defineTool({\n  name:'${slug}',description:'Describe what this tool does.',\n  input:z.object({value:z.string()}),output:z.object({value:z.string()}),\n  permissions:[],\n  async execute({value}){return {value}},\n})\n`},
    plugin:{folder:'plugins',extension:'ts',content:`import { definePlugin } from 'captra'\n\nexport const ${identifier}=definePlugin({\n  name:'${slug}',version:'1.0.0',\n  tools:[],hooks:[],\n})\n`},
  }[kind]
  const target=resolve(directory,'src',templates.folder,`${slug}.${templates.extension}`)
  if(existsSync(target))fail(`Target already exists: ${target}`)
  mkdirSync(dirname(target),{recursive:true});writeFileSync(target,templates.content)
  console.log(`\n✓ Created ${target}\n  Register ${identifier} in src/captra.app.ts.\n`)
}
function copyTemplate(source,destination,replacements){for(const entry of readdirSync(source)){const from=resolve(source,entry),to=resolve(destination,entry),stats=statSync(from);if(stats.isDirectory()){mkdirSync(to,{recursive:true});copyTemplate(from,to,replacements)}else{mkdirSync(dirname(to),{recursive:true});let content=readFileSync(from,'utf8');for(const [token,value] of Object.entries(replacements))content=content.replaceAll(token,value);writeFileSync(to,content)}}}
function packageName(value){return value.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')||'captra-app'}
function title(value){return value.split(/[-_.]+/).filter(Boolean).map(word=>word[0].toUpperCase()+word.slice(1)).join(' ')}
function javascriptName(value){const words=value.split(/[-_.]+/).filter(Boolean);const name=words[0]+words.slice(1).map(word=>word[0].toUpperCase()+word.slice(1)).join('');return /^\d/.test(name)?`captra${name}`:name}
function run(binary,args,cwd){const result=spawnSync(binary,args,{cwd,stdio:'inherit',shell:process.platform==='win32'});process.exit(result.status??1)}
function fail(message){console.error(message);process.exit(1)}
function help(){console.log(`\nCaptra — the capability-first AI application framework\n\n  captra create <directory>\n  captra add capability <name> [directory]\n  captra add tool <name> [directory]\n  captra add plugin <name> [directory]\n  captra doctor [directory]\n  captra dev [directory]\n  captra build [directory]\n  captra test [directory]\n  captra inspect [directory]\n`)}
