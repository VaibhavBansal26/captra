import { useEffect } from 'react'

export function BrandIntro({onComplete}:{onComplete:()=>void}){
  useEffect(()=>{const timer=window.setTimeout(onComplete,3800);return()=>window.clearTimeout(timer)},[onComplete])
  return <div className="brand-intro" role="dialog" aria-label="Welcome to Captra">
    <div className="brand-grid" aria-hidden="true"/>
    <button className="brand-skip" onClick={onComplete}>Skip intro</button>
    <div className="brand-lockup"><svg width="124" height="124" viewBox="0 0 100 100" role="img" aria-label="Captra mark"><circle className="brand-ring" cx="68" cy="50" r="8" fill="none" stroke="#22D3EE" strokeWidth="2"/><path className="brand-arc" d="M74.51 29.43 A32 32 0 1 0 74.51 70.57" fill="none" stroke="#F8FAFC" strokeWidth="12" strokeLinecap="round"/><circle className="brand-dot" cx="68" cy="50" r="8" fill="#22D3EE"/></svg><div className="brand-word" aria-label="captra">{'captra'.split('').map((letter,index)=><span key={index}>{letter}</span>)}</div></div>
    <p className="brand-tag">The AI-native JavaScript framework. Build apps where models are first-class, not bolted on.</p>
    <div className="brand-command"><b>$</b> npm install captra<i/></div>
  </div>
}
