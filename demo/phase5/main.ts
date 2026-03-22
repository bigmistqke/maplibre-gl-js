import { createRenderer } from '../../src/modular/renderer/index.ts'
import { MapGLDemo as MapGL } from '../demo-map.ts'
import { BackgroundLayer } from '../../src/modular/layers/background.ts'
import { FillLayer } from '../../src/modular/layers/fill.ts'
import { LineLayer } from '../../src/modular/layers/line.ts'

const canvas = document.getElementById('map') as HTMLCanvasElement
const status = document.getElementById('status')!

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
  initialCamera: { center: { lng: 0, lat: 20 }, zoom: 1 },
})

map.addLayer(new BackgroundLayer({ color: '#1a1a2e', opacity: 1 }))

map.addSource('mvt', {
  type: 'vector',
  url: 'https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf',
})

const fillLayer = new FillLayer({ source: 'mvt', sourceLayer: 'countries', color: '#2d4a7a', opacity: 0.85 }) as FillLayer & { id: string }
const lineLayer = new LineLayer({ source: 'mvt', sourceLayer: 'countries', color: '#5b8ed6', opacity: 1 }) as LineLayer & { id: string }
fillLayer.id = 'fill'
lineLayer.id = 'lines'

map.addLayer(fillLayer)
map.addLayer(lineLayer)
status.textContent = 'Ready — vector tiles (demotiles.maplibre.org)'

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

let fillVisible = true
let linesVisible = true

document.getElementById('toggle-fill')!.addEventListener('change', (e) => {
  const checked = (e.target as HTMLInputElement).checked
  if (checked && !fillVisible) {
    map.addLayer(fillLayer)
    fillVisible = true
  } else if (!checked && fillVisible) {
    map.removeLayer('fill')
    fillVisible = false
  }
})

document.getElementById('toggle-lines')!.addEventListener('change', (e) => {
  const checked = (e.target as HTMLInputElement).checked
  if (checked && !linesVisible) {
    map.addLayer(lineLayer)
    linesVisible = true
  } else if (!checked && linesVisible) {
    map.removeLayer('lines')
    linesVisible = false
  }
})
