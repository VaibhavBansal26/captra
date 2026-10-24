import { useCallback,useMemo,useState } from 'react'
import { createRuntime,MemoryStore,type CapabilityResult,type RuntimeEvent } from '@captra/core'
import { CapabilityOutput } from '@captra/react'
import { supportApp } from './captra.app'
import './dev.css'
import './logo.css'
import { BrandIntro } from './BrandIntro'

const conversations=[
  {id:'c1',name:'Maya Chen',initials:'MC',subject:'Duplicate charge on Pro plan',time:'2m',tone:'urgent',active:true},
  {id:'c2',name:'Jon Bell',initials:'JB',subject:'Can I switch workspaces?',time:'11m',tone:'neutral'},
  {id:'c3',name:'Sofia Malik',initials:'SM',subject:'Invoice needs company VAT ID',time:'24m',tone:'neutral'},
  {id:'c4',name:'Devon Reed',initials:'DR',subject:'Export completed with errors',time:'38m',tone:'urgent'},
]

const memory=new MemoryStore([
  {id:'m1',tenantId:'captra',scope:'user',ownerId:'maya',type:'preference',content:'Prefers short, direct replies',confidence:.96,createdAt:Date.now()},
  {id:'m2',tenantId:'captra',scope:'project',ownerId:'support',type:'decision',content:'Refunds over $25 require human approval',confidence:1,createdAt:Date.now()},
  {id:'m3',tenantId:'captra',scope:'task',ownerId:'current',type:'working-state',content:'Duplicate invoice INV-2048',confidence:.91,createdAt:Date.now()},
])

function Trace({events}:{events:RuntimeEvent[]}){return <div className="trace">{events.map(event=><div key={event.id}><i className={event.type.includes('completed')?'done':''}/><span><b>{event.type}</b>{event.detail}</span><time>{event.sequence.toString().padStart(2,'0')}</time></div>)}</div>}

export default function App(){
  const [intro,setIntro]=useState(true)
  const runtime=useMemo(()=>createRuntime(supportApp,{memory,authorize:async()=>true}),[])
  const [result,setResult]=useState<CapabilityResult|null>(null)
  const [pending,setPending]=useState(false)
  const [note,setNote]=useState('')
  const [toast,setToast]=useState('')
  const [devOpen,setDevOpen]=useState(false)
  const run=async(capability:string,input:unknown)=>{setPending(true);setToast('');try{const next=await runtime.execute({capability,input,identity:{tenantId:'captra',userId:'maya',projectId:'support'},idempotencyKey:`${capability}-${Date.now()}`});setResult(next)}finally{setPending(false)}}
  const decide=async(decision:'approved'|'rejected')=>{if(!result)return;setPending(true);const next=await runtime.approve(result.run.id,decision);setResult(next);setPending(false);setToast(decision==='approved'?'Refund completed and customer notified':'Refund request rejected')}
  const closeIntro=useCallback(()=>setIntro(false),[])
  return <>{intro&&<BrandIntro onComplete={closeIntro}/>}<div className="app-shell">
    <aside className="rail"><button className="logo" aria-label="Replay Captra intro" onClick={()=>setIntro(true)}><img src="/captra-mark.svg" alt=""/></button><nav><button className="active">⌁<small>Inbox</small></button><button>◫<small>Runs</small></button><button>◇<small>Memory</small></button><button onClick={()=>setDevOpen(true)}>⌘<small>Code</small></button></nav><div className="rail-foot"><button>?</button><div className="avatar">VB</div></div></aside>
    <aside className="inbox"><header><div><span>Workspace</span><strong>Customer ops</strong></div><button>⌄</button></header><div className="inbox-title"><h1>Inbox</h1><span>4 open</span></div><div className="filters"><button className="active">Assigned</button><button>All</button><button>Priority</button></div><div className="search">⌕ <input aria-label="Search conversations" placeholder="Search conversations"/></div><div className="conversation-list">{conversations.map(item=><button key={item.id} className={item.active?'conversation active':'conversation'}><div className="avatar">{item.initials}</div><div><strong>{item.name}</strong><p>{item.subject}</p></div><time>{item.time}</time>{item.tone==='urgent'&&<i/>}</button>)}</div><footer><span>●</span> All systems operational</footer></aside>
    <main className="workspace"><header className="case-head"><div><span className="eyebrow">CONVERSATION #8421</span><h2>Duplicate charge on Pro plan</h2></div><div className="case-actions"><button>⋯</button><button>Close conversation</button></div></header>
      <section className="thread"><div className="date">TODAY, 10:42 AM</div><article className="message customer-message"><div className="avatar">MC</div><div><header><strong>Maya Chen</strong><time>10:42 AM</time></header><p>Hey, I was charged twice for my Pro plan this month. The duplicate is <b>$48</b> on invoice <b>INV-2048</b>. Can you please refund it?</p></div></article><article className="agent-note"><span>✦</span><div><strong>Captra understood the request</strong><p>Possible duplicate payment · billing policy applies · refund requires approval</p></div><em>94% confidence</em></article>
        {result&&<div className="runtime-result"><CapabilityOutput result={result}/>{result.run.status==='waiting_for_approval'&&<div className="approval"><div><span>HUMAN APPROVAL REQUIRED</span><strong>Refund $48.00 to Visa •••• 4242?</strong><p>The validated capability is paused. No payment action has happened yet.</p></div><div><button disabled={pending} onClick={()=>decide('rejected')}>Reject</button><button className="primary" disabled={pending} onClick={()=>decide('approved')}>Approve refund</button></div></div>}</div>}
      </section>
      <section className="composer"><textarea value={note} onChange={event=>setNote(event.target.value)} placeholder="Reply to Maya…"/><div><span>⌘K for capabilities</span><button onClick={()=>{setNote('Hi Maya — I found the duplicate charge and have processed the $48 refund.');setToast('Reply drafted from customer memory')}}>✦ Draft reply</button><button className="send" onClick={()=>{if(note){setToast('Reply sent');setNote('')}}}>Send</button></div></section>
    </main>
    <aside className="copilot"><header><div><span className="spark">✦</span><div><strong>Captra copilot</strong><small>Context-aware · ready</small></div></div><button>×</button></header><section><span className="label">NEXT BEST ACTION</span><h3>Resolve the duplicate charge</h3><p>Billing records and customer history suggest this is a valid duplicate. Captra can complete the workflow safely.</p><div className="action-stack"><button disabled={pending} onClick={()=>run('searchDocs',{query:'duplicate charge refund policy'})}><span>⌕</span><div><strong>Check refund policy</strong><small>Searches verified workspace docs</small></div><b>→</b></button><button disabled={pending} onClick={()=>run('createTicket',{title:'Duplicate charge on INV-2048'})}><span>□</span><div><strong>Create billing ticket</strong><small>Opens a linked support case</small></div><b>→</b></button><button className="recommended" disabled={pending} onClick={()=>run('issueRefund',{transactionId:'txn_2048',amount:48})}><span>↗</span><div><strong>Prepare $48 refund</strong><small>Pauses for your approval</small></div><b>→</b></button></div></section><section className="memory"><div className="section-row"><span className="label">MEMORY IN USE</span><button>View all</button></div>{memory.list().map(item=><div className="memory-row" key={item.id}><i/><div><strong>{item.scope}</strong><p>{item.content}</p></div><em>{Math.round(item.confidence*100)}%</em></div>)}</section><section className="run-trace"><div className="section-row"><span className="label">LIVE RUN</span><em>{result?.run.status.replaceAll('_',' ')??'idle'}</em></div>{result?<Trace events={result.trace}/>:<p className="empty">Choose an action to create a typed, observable run.</p>}</section></aside>
    {toast&&<button className="toast" onClick={()=>setToast('')}>✓ {toast}</button>}
    {devOpen&&<div className="dev-backdrop" onClick={()=>setDevOpen(false)}><aside className="dev-drawer" onClick={event=>event.stopPropagation()}><header><div><span>CAPTRA / DEVELOPER MODE</span><h2>This application consumes the framework</h2></div><button onClick={()=>setDevOpen(false)}>×</button></header><div className="dev-grid"><section><span>PROJECT STRUCTURE</span><pre>{`src/\n├── capabilities/\n│   ├── search-docs.tsx\n│   ├── create-ticket.tsx\n│   └── issue-refund.tsx\n├── support.app.ts\n└── App.tsx\n\nnode_modules/\n├── @captra/core\n├── @captra/react\n└── @captra/server`}</pre></section><section><span>APPLICATION CONTRACT</span><pre className="code"><i>export const</i> supportApp = defineApp({'{'}\n  name: <b>'Captra Customer Ops'</b>,\n  scopes: [<b>'user'</b>, <b>'project'</b>, <b>'task'</b>],\n  capabilities: [\n    searchDocs, createTicket, issueRefund\n  ],\n  surface: capabilityViews(),\n  hooks: [privacy, audit],\n{'}'})</pre><div className="contract-note"><b>One definition powers</b><p>validation · execution · approval · memory · UI · tracing · backend transport</p></div></section></div></aside></div>}
  </div></>
}
