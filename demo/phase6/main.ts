import { createRenderer } from '../../src/mini/renderer/index.ts'
import { GlobeProjection } from '../../src/mini/renderer/globe/globe-projection.ts'
import { MapGL } from '../../src/mini/core/map.ts'
import { BackgroundLayer } from '../../src/mini/layers/background.ts'
import { RasterLayer } from '../../src/mini/layers/raster.ts'

const canvas = document.getElementById('map') as HTMLCanvasElement
const status = document.getElementById('status')!

function resize() {
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * devicePixelRatio
  canvas.height = rect.height * devicePixelRatio
}
resize()
window.addEventListener('resize', resize)

const renderer = await createRenderer(canvas, {
  projection: new GlobeProjection(),
})
const map = new MapGL({
  renderer,
  initialCamera: { center: { lng: 0, lat: 20 }, zoom: 2, bearing: 0, pitch: 0, groundElevation: 0 },
})

map.addLayer(new BackgroundLayer({ color: '#1a1a2e', opacity: 1 }))

map.addSource('osm', {
  type: 'raster',
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
})
map.addLayer(new RasterLayer({ source: 'osm', opacity: 1.0 }))
status.textContent = 'Ready — globe projection with raster tiles'

const zoomInput = document.getElementById('zoom') as HTMLInputElement
const zoomVal = document.getElementById('zoom-val')!
const bearingInput = document.getElementById('bearing') as HTMLInputElement
const bearingVal = document.getElementById('bearing-val')!
const pitchInput = document.getElementById('pitch') as HTMLInputElement
const pitchVal = document.getElementById('pitch-val')!

zoomInput.addEventListener('input', () => {
  const zoom = parseFloat(zoomInput.value)
  map.setCamera({ zoom })
  zoomVal.textContent = zoom.toFixed(1)
})

bearingInput.addEventListener('input', () => {
  const bearing = parseFloat(bearingInput.value)
  map.setCamera({ bearing })
  bearingVal.textContent = bearing.toFixed(0) + '°'
})

pitchInput.addEventListener('input', () => {
  const pitch = parseFloat(pitchInput.value)
  map.setCamera({ pitch })
  pitchVal.textContent = pitch.toFixed(0) + '°'
})

map.on('move', (state: { zoom: number; bearing: number; pitch: number }) => {
  zoomInput.value = String(state.zoom.toFixed(1))
  zoomVal.textContent = state.zoom.toFixed(1)
  bearingInput.value = String(state.bearing.toFixed(0))
  bearingVal.textContent = state.bearing.toFixed(0) + '°'
  pitchInput.value = String(state.pitch.toFixed(0))
  pitchVal.textContent = state.pitch.toFixed(0) + '°'
})

const rotateBtn = document.getElementById('rotate-btn') as HTMLButtonElement
let rotating = false
let lastTime: number | null = null

function rotateFrame(now: number) {
  if (!rotating) return
  if (lastTime !== null) {
    const delta = now - lastTime
    const current = map.getCamera()
    const lng = ((current.center.lng + delta * 0.02) + 180) % 360 - 180
    map.setCamera({ center: { lng, lat: current.center.lat } })
  }
  lastTime = now
  requestAnimationFrame(rotateFrame)
}

rotateBtn.addEventListener('click', () => {
  rotating = !rotating
  rotateBtn.classList.toggle('active', rotating)
  if (rotating) {
    lastTime = null
    requestAnimationFrame(rotateFrame)
  }
})
