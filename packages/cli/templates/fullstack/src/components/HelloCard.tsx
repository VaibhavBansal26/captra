import type { CapabilityViewProps } from 'captra'
import type { HelloResult } from '../capabilities/hello.js'

export function HelloCard({value}:CapabilityViewProps<HelloResult>){return <article className="result"><span>HELLO AI WORLD · {value.provider.toUpperCase()}</span><h2>{value.reply}</h2><p>{value.remembered?'Captra used or saved scoped memory for this run.':'No memory was needed.'}</p></article>}
HelloCard.displayName='HelloCard'
