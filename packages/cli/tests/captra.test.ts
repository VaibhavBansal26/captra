import {spawnSync} from 'node:child_process'
import {resolve} from 'node:path'
import {describe,expect,it} from 'vitest'

const packageRoot=resolve(import.meta.dirname,'..')

describe('captra eval',()=>{
  it('loads TypeScript configs and emits JSON',()=>{const result=spawnSync(process.execPath,['bin/captra.js','eval','test-fixtures/captra.eval.ts','--format=json','--repetitions=2'],{cwd:packageRoot,encoding:'utf8'});expect(result.stderr).toBe('');expect(result.status).toBe(0);const report=JSON.parse(result.stdout);expect(report).toMatchObject({suite:'CLI suite',passed:2,failed:0,confidence:{passRate:{level:.95}}})})
  it('emits GitHub Actions annotations',()=>{const result=spawnSync(process.execPath,['bin/captra.js','eval','test-fixtures/captra.eval.ts','--format=github'],{cwd:packageRoot,encoding:'utf8'});expect(result.status).toBe(0);expect(result.stdout).toContain('::notice title=CLI suite::1/1 passed')})
})
