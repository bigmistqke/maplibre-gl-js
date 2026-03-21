#!/usr/bin/env node
/**
 * Evaluate JS in the running demo browser — convenience wrapper around /eval.
 *
 * Usage:
 *   node scripts/debug-eval.ts '__map.setCamera({ zoom: 3 })'
 *   node scripts/debug-eval.ts '__map.getCamera()'
 *   node scripts/debug-eval.ts --zoom=3
 *   node scripts/debug-eval.ts --zoom=3 --snapshot
 *   node scripts/debug-eval.ts --camera
 *
 * Shortcuts:
 *   --zoom=N           Set zoom level
 *   --center=LNG,LAT   Set center
 *   --camera           Print current camera state
 *   --snapshot         Save screenshot after eval
 */

const args = process.argv.slice(2)
const SERVER_PORT = parseInt(args.find(a => a.startsWith('--server='))?.split('=')[1] ?? '7357')
const base = `http://127.0.0.1:${SERVER_PORT}`
const snapshot = args.includes('--snapshot')

const C = {
  reset: '\x1b[0m', bold: '\x1b[1m', dim: '\x1b[2m',
  green: '\x1b[32m', red: '\x1b[31m', cyan: '\x1b[36m',
}

async function evalExpr(expr: string): Promise<any> {
  const res = await fetch(`${base}/eval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expr }),
  })
  return res.json()
}

async function takeSnapshot() {
  const res = await fetch(`${base}/snapshot`)
  const buf = Buffer.from(await res.arrayBuffer())
  const file = `debug-snapshot-${Date.now()}.png`
  await import('fs').then(fs => fs.writeFileSync(file, buf))
  console.log(`${C.dim}Screenshot: ${file}${C.reset}`)
}

// Build expression from shortcuts
let expr: string | null = null

const zoomArg = args.find(a => a.startsWith('--zoom='))
const centerArg = args.find(a => a.startsWith('--center='))
const cameraArg = args.includes('--camera')
const rawExpr = args.find(a => !a.startsWith('--'))

if (cameraArg) {
  expr = '__map.getCamera()'
} else if (zoomArg || centerArg) {
  const parts: string[] = []
  if (zoomArg) parts.push(`zoom: ${zoomArg.split('=')[1]}`)
  if (centerArg) {
    const [lng, lat] = centerArg.split('=')[1].split(',')
    parts.push(`center: { lng: ${lng}, lat: ${lat} }`)
  }
  expr = `__map.setCamera({ ${parts.join(', ')} })`
} else if (rawExpr) {
  expr = rawExpr
}

if (!expr) {
  console.log('Usage: node scripts/debug-eval.ts --zoom=3')
  console.log('       node scripts/debug-eval.ts --camera')
  console.log('       node scripts/debug-eval.ts \'__map.getCamera()\'')
  process.exit(1)
}

try {
  const result = await evalExpr(expr)
  if (result.ok) {
    if (result.value !== undefined && result.value !== 'undefined') {
      console.log(`${C.green}OK${C.reset}`, JSON.stringify(result.value, null, 2))
    } else {
      console.log(`${C.green}OK${C.reset}`)
    }
  } else {
    console.error(`${C.red}Error${C.reset}: ${result.error}`)
    process.exit(1)
  }
} catch (e: any) {
  console.error(`${C.red}Cannot reach browser server on :${SERVER_PORT}${C.reset}`)
  process.exit(1)
}

if (snapshot) await takeSnapshot()
