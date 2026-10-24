import { describe,expect,it } from 'vitest'
import { migrateCaptra,PostgresMemoryStore,postgresSchema,type SqlClient } from './index'

describe('@captra/postgres',()=>{
  it('installs the durable schema',async()=>{const calls:string[]=[];const client:SqlClient={query:async text=>{calls.push(text);return {rows:[]}}};await migrateCaptra(client);expect(calls[0]).toBe(postgresSchema);expect(postgresSchema).toContain('captra_runs_idempotency');expect(postgresSchema).toContain('captra_memories_recall')})
  it('builds tenant-scoped multi-level recall queries',async()=>{let sql='',values:readonly unknown[]=[];const client:SqlClient={query:async(text,input)=>{sql=text;values=input??[];return {rows:[]}}};const store=new PostgresMemoryStore(client);await store.recall(['user','project','task'],{tenantId:'acme',userId:'u1',projectId:'p1',taskId:'task1'});expect(sql).toContain('tenant_id=$1');expect(values).toEqual(['acme','user','u1','project','p1','task','task1'])})
  it('requires a tenant for durable memory',async()=>{const client:SqlClient={query:async()=>({rows:[]})};const store=new PostgresMemoryStore(client);await expect(store.remember({scope:'user',ownerId:'u1',type:'fact',content:'secret',confidence:1})).rejects.toThrow('requires tenantId')})
})
