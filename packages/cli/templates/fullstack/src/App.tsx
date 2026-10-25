import { useCallback,useState } from 'react'
import { CapabilityOutput } from 'captra/react'
import { CaptraDevtools,type DevtoolsReplay } from 'captra/devtools'
import type { CaptraEvent,RemoteCapabilityResult } from 'captra'
import { HelloCard } from './components/HelloCard.js'
import { client } from './client.js'
import { BrandIntro } from './BrandIntro.js'
import './hello-ai.css'

export default function App(){
  const [intro,setIntro]=useState(true),[message,setMessage]=useState('I am building a fintech dashboard'),[result,setResult]=useState<RemoteCapabilityResult|null>(null),[events,setEvents]=useState<CaptraEvent[]>([]),[replay,setReplay]=useState<DevtoolsReplay|null>(null),[pending,setPending]=useState(false),[error,setError]=useState('')
  const run=async()=>{setPending(true);setError('');setResult(null);setReplay(null);setEvents([]);try{for await(const item of client.stream('hello-ai',{message})){if(item.event==='trace')setEvents(current=>[...current,item.data]);if(item.event==='result'){setResult(item.data);setReplay(await client.replay(item.data.run.id))}if(item.event==='error')throw new Error(item.data.message)}}catch(caught){setError(caught instanceof Error?caught.message:'Run failed')}finally{setPending(false)}}
  const closeIntro=useCallback(()=>setIntro(false),[])
  return <>{intro&&<BrandIntro onComplete={closeIntro}/>}<main className="shell"><div className="topline"><div className="eyebrow">CAPTRA / HELLO AI WORLD</div><button onClick={()=>setIntro(true)}>Replay intro</button></div><h1>Your first agent.<br/>Fully inspectable.</h1><p className="intro">This starter runs Captra’s real agent loop, structured output, scoped memory, tool calls, streaming events, and Devtools. It works in demo mode now; add <code>OPENAI_API_KEY</code> for a live model.</p><section className="runner"><label htmlFor="message">What are you building?</label><textarea id="message" value={message} onChange={event=>setMessage(event.target.value)}/><button disabled={pending||message.trim().length<2} onClick={run}>{pending?'Agent running…':'Run Hello AI →'}</button></section>{pending&&<p className="live">● Live trace · {events.at(-1)?.type??'starting'}</p>}{error&&<p className="error">{error}</p>}{result&&<CapabilityOutput result={result} views={{HelloCard}}/>}<div className="devtools"><CaptraDevtools replay={replay}/></div><footer><span>React client :5173</span><span>Captra runtime :8787</span><span>Demo model · set OPENAI_API_KEY for live AI</span></footer></main></>
}
