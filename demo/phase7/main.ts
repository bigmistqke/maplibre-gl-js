import { createRenderer } from '../../src/modular/renderer/index.ts'
import { MapGL } from '../../src/modular/core/map.ts'
import { BackgroundLayer } from '../../src/modular/layers/background.ts'
import { RasterLayer } from '../../src/modular/layers/raster.ts'
import { TerrainPlugin } from '../../src/modular/layers/terrain/terrain-plugin.ts'

const canvas = document.getElementById('map') as HTMLCanvasElement
const status = document.getElementById('status')!

function resize() {
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * devicePixelRatio
  canvas.height = rect.height * devicePixelRatio
}
resize()
window.addEventListener('resize', resize)

// WebGL2 context required for terrain
const renderer = await createRenderer(canvas, { contextType: 'webgl2' })
const map = new MapGL({
  renderer,
  initialCamera: {
    // Innsbruck — matches MapLibre's 3d-terrain.html demo for direct comparison
    center: { lng: 11.39085, lat: 47.27574 },
    zoom: 12,
    bearing: 0,
    pitch: 70,
    groundElevation: 0,
  },
})

map.addLayer(new BackgroundLayer({ color: '#87CEEB', opacity: 1 }))

map.addSource('osm', {
  type: 'raster',
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
})
map.addLayer(new RasterLayer({ source: 'osm', opacity: 1.0 }))

// DEM source — decoded in worker (matching MapLibre's RasterDEMTileSource approach).
// TerrainPlugin.createDEMSource() injects WorkerDEMTileService so tiles arrive as
// ArrayBuffers with 1px-padded RGBA pixel data rather than ImageBitmaps.
map.addSource('dem', TerrainPlugin.createDEMSource({
  url: 'https://demotiles.maplibre.org/terrain-tiles/{z}/{x}/{y}.png',
  maxZoom: 8,
}))

const terrain = new TerrainPlugin({ source: 'dem', exaggeration: 1 })
map.addPlugin(terrain)

status.textContent = 'Ready — 3D terrain'

// Controls
const zoomInput = document.getElementById('zoom') as HTMLInputElement
const zoomVal = document.getElementById('zoom-val')!
const pitchInput = document.getElementById('pitch') as HTMLInputElement
const pitchVal = document.getElementById('pitch-val')!
const exaggerationInput = document.getElementById('exaggeration') as HTMLInputElement
const exaggerationVal = document.getElementById('exaggeration-val')!

zoomInput.addEventListener('input', () => {
  map.setCamera({ zoom: parseFloat(zoomInput.value) })
  zoomVal.textContent = parseFloat(zoomInput.value).toFixed(1)
})

pitchInput.addEventListener('input', () => {
  map.setCamera({ pitch: parseFloat(pitchInput.value) })
  pitchVal.textContent = parseFloat(pitchInput.value).toFixed(0) + '°'
})

exaggerationInput.addEventListener('input', () => {
  const v = parseFloat(exaggerationInput.value)
  exaggerationVal.textContent = v.toFixed(1) + '×'
  terrain.setExaggeration(v)
  map.setCamera(map.getCamera())  // trigger re-render
})

map.on('move', (state: { zoom: number; pitch: number }) => {
  zoomInput.value = String(state.zoom.toFixed(1))
  zoomVal.textContent = state.zoom.toFixed(1)
  pitchInput.value = String(state.pitch.toFixed(0))
  pitchVal.textContent = state.pitch.toFixed(0) + '°'
})
