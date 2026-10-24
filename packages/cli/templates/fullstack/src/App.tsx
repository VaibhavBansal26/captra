import { useState } from 'react'
import { CapabilityOutput } from '@captra/react'
import type { RemoteCapabilityResult } from '@captra/core'
import { HelloCard } from './capabilities/hello.js'
import { client } from './client.js'

export default function App(){
  const [name,setName]=useState('Captra'),[result,setResult]=useState<RemoteCapabilityResult|null>(null),[pending,setPending]=useState(false),[error,setError]=useState('')
  const run=async()=>{setPending(true);setError('');try{setResult(await client.execute('hello',{name}))}catch(caught){setError(caught instanceof Error?caught.message:'Run failed')}finally{setPending(false)}}
  return <main className="shell"><div className="eyebrow">CAPTRA / FULL-STACK STARTER</div><h1>One contract.<br/>Runtime to UI.</h1><p className="intro">Edit <code>src/capabilities/hello.tsx</code>. Its schema drives validation, execution, memory, typed transport, and this component.</p><section className="runner"><label htmlFor="name">Who should Captra greet?</label><div><input id="name" value={name} onChange={event=>setName(event.target.value)}/><button disabled={pending||!name} onClick={run}>{pending?'Running…':'Run capability →'}</button></div></section>{error&&<p className="error">{error}</p>}{result&&<CapabilityOutput result={result} views={{HelloCard}}/>}<footer><span>React client :5173</span><span>Captra runtime :8787</span><span>Protocol 1.0</span></footer></main>
}
