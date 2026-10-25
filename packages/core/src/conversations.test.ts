import { describe,expect,it } from 'vitest'
import { InMemoryConversationStore } from './conversations.js'

const ada={tenantId:'acme',userId:'ada',projectId:'support'},grace={tenantId:'acme',userId:'grace',projectId:'support'}

describe('conversation store',()=>{
  it('deduplicates messages and paginates backward',async()=>{const store=new InMemoryConversationStore();await store.append('c1',ada,[{id:'1',role:'user',content:'one'},{id:'2',role:'assistant',content:'two'},{id:'3',role:'user',content:'three'}]);await store.append('c1',ada,[{id:'3',role:'user',content:'three'}]);const latest=await store.list('c1',ada,{limit:2});expect(latest.items.map(item=>item.id)).toEqual(['2','3']);expect(latest.nextCursor).toBe('2');const older=await store.list('c1',ada,{cursor:latest.nextCursor,limit:2});expect(older.items.map(item=>item.id)).toEqual(['1'])})
  it('isolates conversation ownership inside a tenant',async()=>{const store=new InMemoryConversationStore();await store.append('private',ada,[{role:'user',content:'secret'}]);await expect(store.list('private',grace)).rejects.toThrow('Conversation not found');await expect(store.list('private',{...ada,tenantId:'other'})).resolves.toEqual({items:[]})})
})
