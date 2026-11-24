// Собирает .vercel/output (Build Output API v3) без локальных билдеров Vercel:
// статика из dist + одна Node-функция /api, собранная esbuild. Затем: vercel deploy --prebuilt --prod
import { build } from 'esbuild'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const out = join(root, 'deploy', '.vercel', 'output')
rmSync(out, { recursive: true, force: true })
mkdirSync(join(out, 'static'), { recursive: true })
cpSync(join(root, 'dist'), join(out, 'static'), { recursive: true })

const fn = join(out, 'functions', 'api.func')
mkdirSync(fn, { recursive: true })
await build({
  entryPoints: [join(root, 'server', 'handler.js')],
  bundle: true, platform: 'node', format: 'cjs', target: 'node22',
  outfile: join(fn, 'index.js'), logLevel: 'warning'
})
writeFileSync(join(fn, '.vc-config.json'), JSON.stringify({
  runtime: 'nodejs22.x', handler: 'index.js', launcherType: 'Nodejs', shouldAddHelpers: true, maxDuration: 50
}))
writeFileSync(join(out, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    { src: '^/api(/.*)?$', dest: '/api?__p=$1' },
    { handle: 'filesystem' }
  ]
}))
console.log('vercel output ready:', out)
