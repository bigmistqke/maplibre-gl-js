import { createRenderer } from '../../src/mini/renderer/index.ts'
import { MapGL } from '../../src/mini/core/map.ts'
import { BackgroundLayer } from '../../src/mini/layers/background.ts'
import { RasterLayer } from '../../src/mini/layers/raster.ts'
import { WorkerRasterTileService } from '../../src/mini/layers/raster-worker-service.ts'
import type { TileID } from '../../src/mini/core/types.ts'
import type { TileService } from '../../src/mini/core/tile-service.ts'

const canvas = document.getElementById('map') as HTMLCanvasElement
const status = document.getElementById('status')!
const statLoaded = document.getElementById('stat-loaded')!
const statAvg = document.getElementById('stat-avg')!
const workerDot = document.getElementById('worker-dot')!
const workerLabel = document.getElementById('worker-label')!

function resize() {
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * devicePixelRatio
  canvas.height = rect.height * devicePixelRatio
}
resize()
window.addEventListener('resize', resize)

// Instrumented wrapper around WorkerRasterTileService to track timing
let totalLoaded = 0
let totalMs = 0
let inFlight = 0
let workerIdleTimer: ReturnType<typeof setTimeout> | null = null

function setWorkerActive() {
  workerDot.classList.add('active')
  workerLabel.textContent = `Worker active (${inFlight} in flight)`
  if (workerIdleTimer) clearTimeout(workerIdleTimer)
}

function setWorkerIdle() {
  workerIdleTimer = setTimeout(() => {
    workerDot.classList.remove('active')
    workerLabel.textContent = 'Worker idle'
  }, 300)
}

class InstrumentedWorkerService implements TileService {
  private _inner = new WorkerRasterTileService()

  async request(tileID: TileID, url: string): Promise<Transferable[]> {
    inFlight++
    setWorkerActive()
    const t0 = performance.now()
    try {
      const result = await this._inner.request(tileID, url)
      if (result.length > 0) {
        const ms = performance.now() - t0
        totalLoaded++
        totalMs += ms
        statLoaded.textContent = String(totalLoaded)
        statAvg.textContent = (totalMs / totalLoaded).toFixed(0)
      }
      return result
    } finally {
      inFlight--
      if (inFlight === 0) setWorkerIdle()
      else workerLabel.textContent = `Worker active (${inFlight} in flight)`
    }
  }

  cancel(key: string): void { this._inner.cancel(key) }
  destroy(): void { this._inner.destroy() }
}

const renderer = await createRenderer(canvas)
const map = new MapGL({
  renderer,
  initialCamera: { center: { lng: 4.9, lat: 52.37 }, zoom: 5 },
})

map.addLayer(new BackgroundLayer({ color: '#e5e3df', opacity: 1 }))
map.addSource('tiles', {
  type: 'raster',
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileSize: 256,
  tileService: new InstrumentedWorkerService(),
})
map.addLayer(new RasterLayer({ source: 'tiles', opacity: 1 }))
status.textContent = 'Ready — Comlink Web Worker'

const zoomInput = document.getElementById('zoom') as HTMLInputElement
const zoomVal = document.getElementById('zoom-val')!

zoomInput.addEventListener('input', () => {
  const zoom = parseFloat(zoomInput.value)
  map.setCamera({ zoom })
  zoomVal.textContent = zoom.toFixed(1)
})

map.on('move', (state: { zoom: number }) => {
  zoomInput.value = state.zoom.toFixed(1)
  zoomVal.textContent = state.zoom.toFixed(1)
})
