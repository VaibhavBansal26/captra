import { createServer } from 'node:http'
import { createRuntime } from 'captra'
import { createCaptraHandler } from 'captra/server'
import { createNodeHandler } from 'captra/server/node'
import { app } from './captra.app.js'

const runtime=createRuntime(app)
const handler=createCaptraHandler(runtime,{basePath:'/api/captra',auth:async()=>({tenantId:'local',userId:'developer',projectId:'starter'})})
const port=Number(process.env.PORT??8787)
createServer(createNodeHandler(handler)).listen(port,'127.0.0.1',()=>console.log(`Captra backend ready on http://127.0.0.1:${port}/api/captra`))
