import {describe,expect,it,vi} from 'vitest'
import {createMemoryPersistence,createState,hashStateKey} from './index.js'

describe('CaptraState',()=>{
  it('uses stable typed keys and prefix invalidation',()=>{expect(hashStateKey(['account',{b:2,a:1}])).toBe(hashStateKey(['account',{a:1,b:2}]));const state=createState();state.set(['todos','one'],[1]);state.set(['profile'],{name:'Ada'});expect(state.invalidate(['todos'])).toBe(1);expect(state.snapshot(['todos','one']).stale).toBe(true);expect(state.snapshot(['profile']).stale).toBe(false)})
  it('deduplicates requests and reports lifecycle',async()=>{const state=createState(),load=vi.fn(async()=>42),first=state.fetch('answer',load),second=state.fetch('answer',load);expect(state.snapshot('answer').status).toBe('loading');expect(await first).toBe(42);expect(await second).toBe(42);expect(load).toHaveBeenCalledOnce();expect(state.snapshot('answer')).toMatchObject({data:42,status:'success',stale:false})})
  it('rolls optimistic state back safely',()=>{const state=createState();state.set('count',1);const update=state.optimistic<number>('count',value=>(value??0)+1);expect(state.get('count')).toBe(2);update.rollback();expect(state.get('count')).toBe(1)})
  it('hydrates persisted successful state',async()=>{const persistence=createMemoryPersistence(),first=createState({persistence});first.set('user',{name:'Lin'});await new Promise(resolve=>queueMicrotask(resolve));const second=createState({persistence});await second.restore();expect(second.get('user')).toEqual({name:'Lin'})})
})
