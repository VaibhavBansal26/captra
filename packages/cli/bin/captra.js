#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

const [, , command='help', argument] = process.argv
const root=resolve(argument??'.')

if(command==='create'||command==='init') createProject(root)
else if(command==='dev') run('npm',['run','dev'],root)
else if(command==='build') run('npm',['run','build'],root)
else if(command==='test') run('npm',['test'],root)
else if(command==='inspect') inspect(root)
else help()

function createProject(directory){
  if(existsSync(directory)) fail(`Target already exists: ${directory}`)
  mkdirSync(resolve(directory,'src/capabilities'),{recursive:true})
  files(directory,{
    'package.json':JSON.stringify({name:basename(directory),private:true,type:'module',scripts:{dev:'vite',build:'tsc --noEmit && vite build'},dependencies:{'@captra/core':'^0.1.0','@captra/react':'^0.1.0',react:'^19.0.0','react-dom':'^19.0.0',vite:'^7.0.0',typescript:'^5.9.0',zod:'^4.0.0'},devDependencies:{'@types/react':'^19.0.0','@types/react-dom':'^19.0.0','@vitejs/plugin-react':'^5.0.0'}},null,2),
    'index.html':'<main id="root"></main><script type="module" src="/src/main.tsx"></script>',
    'src/capabilities/hello.tsx':`import { capability } from '@captra/core'\nimport { z } from 'zod'\n\nexport const hello=capability({\n  name:'hello', description:'Greet a person',\n  input:z.object({name:z.string()}), output:z.object({message:z.string()}),\n  memory:['user'], approval:'never',\n  run:async({name})=>({message:\`Hello \${name}\`}),\n  view:({value})=><strong>{value.message}</strong>,\n})\n`,
    'src/captra.app.ts':`import { defineApp, capabilityViews } from '@captra/core'\nimport { hello } from './capabilities/hello'\n\nexport default defineApp({\n  name:'${basename(directory)}',\n  scopes:['user'],\n  capabilities:[hello],\n  surface:capabilityViews(),\n})\n`,
    'src/main.tsx':`import { StrictMode } from 'react'\nimport { createRoot } from 'react-dom/client'\nimport { useCaptra, CapabilityOutput } from '@captra/react'\nimport app from './captra.app'\n\nfunction App(){const {run,result}=useCaptra(app);return <main><h1>{app.name}</h1><button onClick={()=>run('hello',{name:'Captra'})}>Run capability</button>{result&&<CapabilityOutput result={result}/>}</main>}\ncreateRoot(document.getElementById('root')!).render(<StrictMode><App/></StrictMode>)\n`,
    'tsconfig.json':JSON.stringify({compilerOptions:{target:'ES2022',lib:['ES2022','DOM'],module:'ESNext',moduleResolution:'Bundler',strict:true,jsx:'react-jsx',noEmit:true,skipLibCheck:true},include:['src']},null,2),
    'vite.config.ts':`import { defineConfig } from 'vite'\nimport react from '@vitejs/plugin-react'\nexport default defineConfig({plugins:[react()]})\n`,
  })
  console.log(`\n  Captra app created at ${directory}\n\n  cd ${basename(directory)}\n  npm install\n  npx captra dev\n`)
}

function inspect(directory){
  const required=['package.json','src/captra.app.ts','src/capabilities']
  console.log(`\nCaptra project: ${directory}`)
  for(const item of required)console.log(`${existsSync(resolve(directory,item))?'✓':'×'} ${item}`)
  const pkgPath=resolve(directory,'package.json')
  if(existsSync(pkgPath)){const pkg=JSON.parse(readFileSync(pkgPath,'utf8'));const deps={...pkg.dependencies,...pkg.devDependencies};for(const name of ['@captra/core','@captra/react'])console.log(`${deps[name]?'✓':'×'} ${name}${deps[name]?` ${deps[name]}`:''}`)}
  console.log('')
}
function files(directory,map){for(const [path,content] of Object.entries(map))writeFileSync(resolve(directory,path),content+'\n')}
function run(binary,args,cwd){const result=spawnSync(binary,args,{cwd,stdio:'inherit',shell:process.platform==='win32'});process.exit(result.status??1)}
function fail(message){console.error(message);process.exit(1)}
function help(){console.log(`\nCaptra — the capability-first AI application framework\n\n  captra create <directory>\n  captra dev [directory]\n  captra build [directory]\n  captra test [directory]\n  captra inspect [directory]\n`)}
