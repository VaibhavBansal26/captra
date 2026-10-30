export class InjectedFaultError extends Error {
  constructor(readonly checkpoint:string,readonly occurrence:number){super(`Injected fault at ${checkpoint} (${occurrence})`);this.name='InjectedFaultError'}
}

/** Deterministic, test-only fault scheduler. No timers or randomness are involved. */
export class DeterministicFaultInjector {
  readonly #counts=new Map<string,number>()
  readonly #schedule=new Map<string,Set<number>>()
  constructor(schedule:Record<string,number|readonly number[]>={}){for(const [name,value] of Object.entries(schedule))this.#schedule.set(name,new Set(typeof value==='number'?[value]:value))}
  checkpoint(name:string){const occurrence=(this.#counts.get(name)??0)+1;this.#counts.set(name,occurrence);if(this.#schedule.get(name)?.has(occurrence))throw new InjectedFaultError(name,occurrence)}
  count(name:string){return this.#counts.get(name)??0}
  reset(){this.#counts.clear()}
}
