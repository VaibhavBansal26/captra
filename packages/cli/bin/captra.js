#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { basename, dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const [, , command='help', ...arguments_] = process.argv
const positional=arguments_.filter(value=>!value.startsWith('--')),argument=positional[0],root=resolve(argument??'.')
const templateRoot=resolve(dirname(fileURLToPath(import.meta.url)),'../templates/fullstack')

if(command==='create'||command==='init') createProject(root)
else if(command==='dev') run('npm',['run','dev'],root)
else if(command==='build'){if(!secretCheck(root,{dist:false}))process.exit(1);run('npm',['run','build'],root)}
else if(command==='test') run('npm',['test'],root)
else if(command==='inspect') inspect(root)
else if(command==='doctor') doctor(root)
else if(command==='secrets'||command==='check-secrets'){if(!secretCheck(root,{dist:arguments_.includes('--dist')}))process.exitCode=1}
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
  check('No browser-exposed secrets',secretCheck(directory,{dist:false,quiet:true}),'run captra secrets for findings')
  console.log(`\n${findings.every(item=>item.passed)?'Ready — no blocking issues found.':`${findings.filter(item=>!item.passed).length} issue(s) need attention.`}\n`)
  if(findings.some(item=>!item.passed))process.exitCode=1
}
function secretCheck(directory,{dist=false,quiet=false}={}){
  const config=readSecurityConfig(directory),findings=[...scanPublicEnv(directory,config)]
  const sources=dist?listFiles(resolve(directory,config.outputDirectory??'dist'),file=>/\.(?:js|mjs|cjs|html|css)$/i.test(file)):browserGraph(directory,config)
  for(const file of sources)if(!ignored(file,directory,config.ignoreFiles)){const content=readFileSync(file,'utf8');findings.push(...scanContent(content,file,directory,config,{compiled:dist}))}
  if(!quiet){console.log(`\nCaptra secret check: ${directory}${dist?' (compiled output)':''}`);if(findings.length)for(const finding of findings)console.log(`× ${finding.file}:${finding.line} — ${finding.message}`);else console.log(`✓ No browser-reachable secrets or server-only imports found`);console.log('')}
  return findings.length===0
}
function readSecurityConfig(directory){const path=resolve(directory,'package.json');if(!existsSync(path))return {};try{return JSON.parse(readFileSync(path,'utf8')).captra?.security?.secretCheck??{}}catch{return {}}}
function scanPublicEnv(directory,config){const findings=[];for(const file of ['.env','.env.local','.env.development','.env.production']){const path=resolve(directory,file);if(!existsSync(path)||ignored(path,directory,config.ignoreFiles))continue;readFileSync(path,'utf8').split(/\r?\n/).forEach((line,index)=>{const name=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];if(name&&isSensitiveName(name)&&isPublicEnv(name)&&!(config.allowEnv??[]).includes(name))findings.push({file,line:index+1,message:`public environment variable ${name} looks secret`})})}return findings}
function scanContent(content,file,directory,config,{compiled}){const findings=[],display=relative(directory,file)||basename(file),lines=content.split(/\r?\n/),allowEnv=new Set(config.allowEnv??[]),serverImports=/^(?:node:|captra\/(?:server|openai|postgres)|@captra-ai\/(?:server|openai|postgres))(?:\/|$)/
  lines.forEach((line,index)=>{
    if(!compiled&&!/^\s*(?:import|export)\s+type\b/.test(line)){for(const match of line.matchAll(/(?:from\s*|import\s*(?:\(\s*)?|require\s*\(\s*)['"]([^'"]+)['"]/g))if(serverImports.test(match[1]))findings.push({file:display,line:index+1,message:`server-only import ${match[1]} is browser-reachable`})}
    for(const match of line.matchAll(/(?:process\.env|import\.meta\.env)(?:\.([A-Za-z_][A-Za-z0-9_]*)|\[['"]([^'"]+)['"]\])/g)){const name=match[1]??match[2];if(!allowEnv.has(name)&&(match[0].startsWith('process.env')||isSensitiveName(name)))findings.push({file:display,line:index+1,message:`browser-reachable environment access ${name}`})}
    if(/(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|gh(?:p|o|u|s|r)_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})/.test(line))findings.push({file:display,line:index+1,message:'credential-like literal found; value hidden'})
  });return findings
}
function browserGraph(directory,config){const configured=(config.browserEntries??[]).map(value=>resolve(directory,value)),defaults=['src/main.ts','src/main.tsx','src/main.js','src/main.jsx','src/client.ts','src/client.tsx','src/client.js','src/client.jsx'].map(value=>resolve(directory,value)),queue=(configured.length?configured:defaults).filter(existsSync),seen=new Set(),files=[];while(queue.length){const file=queue.shift();if(seen.has(file)||!existsSync(file))continue;seen.add(file);files.push(file);const content=readFileSync(file,'utf8');for(const line of content.split(/\r?\n/)){if(/^\s*import\s+type\b/.test(line)||/^\s*export\s+type\b/.test(line))continue;for(const match of line.matchAll(/(?:from\s*|import\s*\()\s*['"](\.[^'"]+)['"]/g)){const target=resolveModule(dirname(file),match[1]);if(target)queue.push(target)}}}return files}
function resolveModule(directory,specifier){const base=resolve(directory,specifier),withoutJs=/\.js$/i.test(base)?base.slice(0,-3):base;for(const candidate of [base,withoutJs,`${withoutJs}.ts`,`${withoutJs}.tsx`,`${withoutJs}.js`,`${withoutJs}.jsx`,resolve(withoutJs,'index.ts'),resolve(withoutJs,'index.tsx'),resolve(withoutJs,'index.js')])if(existsSync(candidate)&&statSync(candidate).isFile())return candidate}
function listFiles(directory,accept){if(!existsSync(directory))return [];const files=[];for(const entry of readdirSync(directory)){const path=resolve(directory,entry),stats=statSync(path);if(stats.isDirectory())files.push(...listFiles(path,accept));else if(accept(path))files.push(path)}return files}
function ignored(file,directory,patterns=[]){const name=relative(directory,file).replaceAll('\\','/');return patterns.some(pattern=>name===pattern||pattern.endsWith('/**')&&name.startsWith(pattern.slice(0,-3)))}
function isSensitiveName(name){return /(?:OPENAI|ANTHROPIC|GEMINI|GOOGLE.*AI|DATABASE|POSTGRES|API[_-]?KEY|SECRET|TOKEN|PRIVATE[_-]?KEY|PASSWORD)/i.test(name)}
function isPublicEnv(name){return /^(?:VITE_|NEXT_PUBLIC_|PUBLIC_|REACT_APP_)/i.test(name)}
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
function help(){console.log(`\nCaptra — the capability-first AI application framework\n\n  captra create <directory>\n  captra add capability <name> [directory]\n  captra add tool <name> [directory]\n  captra add plugin <name> [directory]\n  captra doctor [directory]\n  captra secrets [directory] [--dist]\n  captra dev [directory]\n  captra build [directory]\n  captra test [directory]\n  captra inspect [directory]\n`)}
