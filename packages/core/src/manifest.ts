import { toJSONSchema } from 'zod'
import type { AgentApp } from './core'

export function compileManifest(app:AgentApp){
  return {schema:'https://captra.dev/schema/manifest-v1.json',name:app.name,version:app.version,protocol:'1.0',scopes:app.scopes,capabilities:app.capabilities.map(capability=>({name:capability.name,description:capability.description,input:toJSONSchema(capability.input),output:toJSONSchema(capability.output),memory:capability.scopes,permissions:capability.permissions,approval:capability.approval,idempotent:capability.idempotent,view:capability.view.name}))}
}
