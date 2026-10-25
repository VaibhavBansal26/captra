import { afterAll,beforeAll,describe,expect,it } from 'vitest'
import { Pool } from 'pg'
import { StateConflictError,StateLeaseError } from '@captra-ai/state'
import { migrateCaptra,migrateCaptraVectors,PostgresCheckpointStore,PostgresConversationStore,PostgresMemoryStore,PostgresRunStore,PostgresSemanticMemoryStore,PostgresSharedStateAdapter,PostgresWorkQueue,type SqlClient } from './index.js'

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

  it('persists deduplicated conversation pages inside tenant and owner boundaries',async()=>{
    const conversations=new PostgresConversationStore(client),ada={tenantId:'chat',userId:'ada',projectId:'p1'},grace={tenantId:'chat',userId:'grace',projectId:'p1'}
    await conversations.append('c1',ada,[{id:'m1',role:'user',content:'one'},{id:'m2',role:'assistant',content:'two'},{id:'m3',role:'user',content:'three'}])
    expect(await conversations.append('c1',ada,[{id:'m3',role:'user',content:'three'}])).toEqual([])
    const latest=await conversations.list('c1',ada,{limit:2});expect(latest.items.map(item=>item.id)).toEqual(['m2','m3']);expect(latest.nextCursor).toBe('m2')
    const older=await conversations.list('c1',ada,{cursor:latest.nextCursor,limit:2});expect(older.items.map(item=>item.id)).toEqual(['m1']);expect(older.nextCursor).toBeUndefined()
    await Promise.all(Array.from({length:8},()=>conversations.append('c1',ada,[{id:'m4',role:'assistant',content:'once'}])))
    expect((await conversations.list('c1',ada,{limit:10})).items.filter(item=>item.id==='m4')).toHaveLength(1)
    await expect(conversations.list('c1',grace)).rejects.toThrow('Conversation not found')
    await expect(conversations.append('c1',grace,[{role:'user',content:'intrusion'}])).rejects.toThrow('Conversation not found')
    expect(await conversations.list('c1',{...ada,tenantId:'other'})).toEqual({items:[],nextCursor:undefined})
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

  it('allows only one concurrent versioned state commit and preserves tenant isolation',async()=>{
    const acme=new PostgresSharedStateAdapter(client,'acme-state'),other=new PostgresSharedStateAdapter(client,'other-state'),key=['inventory','sku-1']
    const results=await Promise.allSettled(Array.from({length:8},(_,value)=>acme.commit(key,{value},{expectedVersion:0,actor:`agent-${value}`})))
    expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1)
    expect(results.filter(result=>result.status==='rejected').every(result=>result.reason instanceof StateConflictError)).toBe(true)
    expect((await acme.read<{value:number}>(key)).version).toBe(1)
    expect(await other.read(key)).toMatchObject({value:undefined,version:0})
    const history=await acme.history(key);expect(history.filter(event=>event.type==='state.committed')).toHaveLength(1);expect(history.filter(event=>event.type==='state.conflict')).toHaveLength(7)
  })

  it('fences an expired lease after another agent takes ownership',async()=>{
    const state=new PostgresSharedStateAdapter(client,'lease-state'),key=['order','o1'],expired=await state.acquire(key,{owner:'agent-old',ttlMs:20})
    await new Promise(resolve=>setTimeout(resolve,30))
    const active=await state.acquire(key,{owner:'agent-new',ttlMs:5_000});expect(active.token).toBeGreaterThan(expired.token)
    await expect(state.commit(key,{status:'old'},{expectedVersion:0,actor:'agent-old',lease:expired})).rejects.toBeInstanceOf(StateLeaseError)
    await expect(state.commit(['order','other'],{status:'wrong-key'},{expectedVersion:0,actor:'agent-new',lease:active})).rejects.toThrow('different state key')
    await state.commit(key,{status:'allocated'},{expectedVersion:0,actor:'agent-new',lease:active})
    await state.release(active)
    expect(await state.read(key)).toMatchObject({value:{status:'allocated'},version:1})
    expect((await state.history(key)).map(event=>event.type)).toEqual(['lease.acquired','lease.acquired','state.committed','lease.released'])
  })
})
