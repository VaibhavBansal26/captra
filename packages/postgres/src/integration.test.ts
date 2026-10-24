import { afterAll,beforeAll,describe,expect,it } from 'vitest'
import { Pool } from 'pg'
import { migrateCaptra,migrateCaptraVectors,PostgresCheckpointStore,PostgresMemoryStore,PostgresRunStore,PostgresSemanticMemoryStore,PostgresWorkQueue,type SqlClient } from './index.js'

const connectionString=process.env.CAPTRA_POSTGRES_URL
const suite=connectionString?describe:describe.skip
const schema=`captra_test_${process.pid}_${Date.now()}`
let admin:Pool,database:Pool,client:SqlClient

suite('PostgreSQL integration',()=>{
  beforeAll(async()=>{
    admin=new Pool({connectionString});await admin.query(`CREATE SCHEMA ${schema}`)
    database=new Pool({connectionString,options:`-c search_path=${schema}`})
    client={query:async(text,values)=>{const result=await database.query(text,[...(values??[])]);return {rows:result.rows,rowCount:result.rowCount}}}
    await migrateCaptra(client);await migrateCaptraVectors(client,3)
  },30_000)
  afterAll(async()=>{await database?.end();if(admin){await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);await admin.end()}},30_000)

  it('enforces tenant idempotency and serial event ordering under concurrency',async()=>{
    const runs=new PostgresRunStore(client),identity={tenantId:'acme',userId:'u1',projectId:'p1'},create={app:'Test',appVersion:'1.0.0',capability:'work',input:{value:1},identity,idempotencyKey:'same'}
    const created=await Promise.all(Array.from({length:6},()=>runs.create(create)));expect(new Set(created.map(run=>run.id)).size).toBe(1)
    const runId=created[0].id
    await Promise.all(Array.from({length:12},(_,index)=>runs.appendEvent(runId,{type:'agent.step',capability:'work',detail:String(index)})))
    expect((await runs.events(runId)).map(event=>event.sequence)).toEqual(Array.from({length:12},(_,index)=>index+1))
    expect((await runs.findByIdempotencyKey('other','same'))).toBeUndefined()
  })

  it('persists scoped memory while excluding other tenants and expired records',async()=>{
    const memory=new PostgresMemoryStore(client)
    await memory.remember({tenantId:'acme',scope:'user',ownerId:'u1',type:'preference',content:'Prefers dark mode',confidence:.9})
    await memory.remember({tenantId:'other',scope:'user',ownerId:'u1',type:'fact',content:'Other tenant',confidence:1})
    await memory.remember({tenantId:'acme',scope:'user',ownerId:'u1',type:'fact',content:'Expired fact',confidence:1,expiresAt:Date.now()-1_000})
    const recalled=await memory.recall(['user'],{tenantId:'acme',userId:'u1',projectId:'p1'})
    expect(recalled.map(item=>item.content)).toEqual(['Prefers dark mode'])
  })

  it('deduplicates and ranks semantic memory with pgvector',async()=>{
    const vectors:Record<string,number[]>={'Dark mode':[1,0,0],'Dark theme':[1,0,0],'Invoice reminders':[0,1,0]},memory=new PostgresSemanticMemoryStore(client,{embed:async texts=>texts.map(text=>vectors[text]??[0,0,1])},{dimensions:3,minSimilarity:.5,deduplicateSimilarity:.99})
    const first=await memory.remember({tenantId:'vector',scope:'user',ownerId:'u1',type:'preference',content:'Dark mode',confidence:1}),duplicate=await memory.remember({tenantId:'vector',scope:'user',ownerId:'u1',type:'preference',content:'Dark theme',confidence:1})
    await memory.remember({tenantId:'vector',scope:'user',ownerId:'u1',type:'preference',content:'Invoice reminders',confidence:1})
    expect(duplicate.id).toBe(first.id)
    expect((await memory.recall(['user'],{tenantId:'vector',userId:'u1',projectId:'p1'},{query:'Dark theme'}))[0].content).toBe('Dark mode')
  })

  it('serializes checkpoints and leases queue work to only one worker',async()=>{
    const runs=new PostgresRunStore(client),run=await runs.create({app:'Test',appVersion:'1.0.0',capability:'queued',input:{},identity:{tenantId:'queue',userId:'u1',projectId:'p1'}}),checkpoints=new PostgresCheckpointStore(client)
    await Promise.all(Array.from({length:8},(_,step)=>checkpoints.save(run.id,'agent/state',{step})))
    expect((await checkpoints.list(run.id)).map(item=>item.sequence)).toEqual([1,2,3,4,5,6,7,8])
    const queue=new PostgresWorkQueue(client);await queue.enqueue({runId:run.id,maxAttempts:3})
    const claims=await Promise.all(['worker-a','worker-b'].map(worker=>queue.claim(worker,30_000))),leased=claims.filter(Boolean)
    expect(leased).toHaveLength(1);expect(await queue.heartbeat(leased[0]!.id,leased[0]!.leasedBy!,30_000)).toBe(true);expect(await queue.ack(leased[0]!.id,leased[0]!.leasedBy!)).toBe(true);expect(await queue.claim('worker-c',30_000)).toBeUndefined()
  })
})
