import { toJSONSchema } from 'zod'
import type { AgentApp } from './core.js'

export function compileManifest(app:AgentApp){
  return {schema:'https://captra.dev/schema/manifest-v1.json',name:app.name,version:app.version,protocol:'1.0',scopes:app.scopes,capabilities:app.capabilities.map(capability=>({name:capability.name,mode:capability.mode,description:capability.description,input:toJSONSchema(capability.input),output:toJSONSchema(capability.output),memory:capability.scopes,permissions:capability.permissions,approval:capability.approval,idempotent:capability.idempotent,policy:capability.policy,view:capability.view.name})),tools:app.tools.map(tool=>({name:tool.name,description:tool.description,input:toJSONSchema(tool.input),output:toJSONSchema(tool.output),permissions:tool.permissions}))}
}
