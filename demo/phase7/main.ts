import { createRenderer } from '../../src/mini/renderer/index.ts'
import { MapGL } from '../../src/mini/core/map.ts'
import { BackgroundLayer } from '../../src/mini/layers/background.ts'
import { RasterLayer } from '../../src/mini/layers/raster.ts'
import { TerrainPlugin } from '../../src/mini/layers/terrain/terrain-plugin.ts'

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
    // Swiss Alps — good terrain showcase
    center: { lng: 8.0, lat: 46.5 },
    zoom: 8,
    bearing: 0,
    pitch: 45,
    groundElevation: 0,
  },
})

map.addLayer(new BackgroundLayer({ color: '#87CEEB', opacity: 1 }))

map.addSource('osm', {
  type: 'raster',
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
})
map.addLayer(new RasterLayer({ source: 'osm', opacity: 1.0 }))

// DEM source — terrain-RGB encoded elevation
// Replace YOUR_MAPTILER_KEY with a real key from maptiler.com
map.addSource('dem', {
  type: 'raster',
  url: 'https://api.maptiler.com/tiles/terrain-rgb/{z}/{x}/{y}.png?key=YOUR_MAPTILER_KEY',
})

const terrain = new TerrainPlugin({ source: 'dem', exaggeration: 1.5 })
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
  // TerrainPlugin doesn't support live exaggeration update yet — reload to see change
})

map.on('move', (state: { zoom: number; pitch: number }) => {
  zoomInput.value = String(state.zoom.toFixed(1))
  zoomVal.textContent = state.zoom.toFixed(1)
  pitchInput.value = String(state.pitch.toFixed(0))
  pitchVal.textContent = state.pitch.toFixed(0) + '°'
})
