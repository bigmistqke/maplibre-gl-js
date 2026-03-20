import { createRenderer } from '../../src/modular/renderer/index.ts'
import { MapGL } from '../../src/modular/core/map.ts'
import { BackgroundLayer } from '../../src/modular/layers/background.ts'
import { RasterLayer, RasterTileService } from '../../src/modular/layers/raster.ts'

const canvas = document.getElementById('map') as HTMLCanvasElement
const status = document.getElementById('status')!
const statCached = document.getElementById('stat-cached')!
const statVisible = document.getElementById('stat-visible')!
const statEvicted = document.getElementById('stat-evicted')!

function resize() {
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * devicePixelRatio
  canvas.height = rect.height * devicePixelRatio
}
resize()
window.addEventListener('resize', resize)

const renderer = await createRenderer(canvas)
const map = new MapGL({
  renderer,
  initialCamera: { center: { lng: 4.9, lat: 52.37 }, zoom: 3 },
})

map.addLayer(new BackgroundLayer({ color: '#e5e3df', opacity: 1 }))
map.addSource('tiles', {
  type: 'raster',
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  tileSize: 256,
  tileService: new RasterTileService(),
})
map.addLayer(new RasterLayer({ source: 'tiles', opacity: 1 }))
status.textContent = 'Ready — FIFO eviction active'

// Track approximate tile counts by watching network requests
let loadedCount = 0
let evictedCount = 0
const loadedKeys = new Set<string>()

// We can approximate visible tile count from zoom level
function estimateVisibleTiles(zoom: number): number {
  const z = Math.floor(zoom)
  const tilesAcross = Math.ceil(canvas.width / devicePixelRatio / 256) + 2
  const tilesDown = Math.ceil(canvas.height / devicePixelRatio / 256) + 2
  return tilesAcross * tilesDown
}

function updateStats(zoom: number) {
  const visible = estimateVisibleTiles(zoom)
  // Cache = viewport * 5 (from TileManager.updateCacheSize)
  const maxCache = visible * 5
  statVisible.textContent = String(visible)
  statCached.textContent = `≤ ${maxCache}`
  statEvicted.textContent = String(evictedCount)
}

const zoomInput = document.getElementById('zoom') as HTMLInputElement
const zoomVal = document.getElementById('zoom-val')!

zoomInput.addEventListener('input', () => {
  const zoom = parseFloat(zoomInput.value)
  map.setCamera({ zoom })
  zoomVal.textContent = zoom.toFixed(1)
  updateStats(zoom)
})

map.on('move', (state: { zoom: number }) => {
  zoomInput.value = state.zoom.toFixed(1)
  zoomVal.textContent = state.zoom.toFixed(1)
  updateStats(state.zoom)
})

updateStats(3)
