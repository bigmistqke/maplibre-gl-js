// demo/phase9/main.ts
import { createRenderer } from '../../src/modular/renderer/index.ts'
import { MapGL } from '../../src/modular/core/map.ts'
import { BackgroundLayer } from '../../src/modular/layers/background.ts'
import { FillLayer } from '../../src/modular/layers/fill.ts'
import { GlyphManager } from '../../src/modular/layers/symbol/glyph-manager.ts'
import { TextLayer } from '../../src/modular/layers/symbol/text-layer.ts'
import { Placement } from '../../src/modular/layers/symbol/placement.ts'

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
  initialCamera: {
    center: { lng: 10, lat: 51 },
    zoom: 5,
    bearing: 0,
    pitch: 0,
    groundElevation: 0,
  },
})

map.addLayer(new BackgroundLayer({ color: '#f8f4f0', opacity: 1 }))

map.addSource('openmaptiles', {
  type: 'vector',
  url: 'https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf',
  minZoom: 0,
  maxZoom: 6,
})

map.addLayer(new FillLayer({
  source: 'openmaptiles',
  sourceLayer: 'countries',
  color: '#d4e8c2',
  opacity: 0.8,
}))

const glyphs = new GlyphManager({
  url: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
})

const textLayer = new TextLayer({
  source: 'openmaptiles',
  sourceLayer: 'place_labels',
  textField: '{name}',
  fontstack: 'Open Sans Regular',
  fontSize: 14,
  color: '#333333',
  glyphs,
})

map.addPlugin(new Placement())
map.addLayer(textLayer)

const zoomSlider = document.getElementById('zoom') as HTMLInputElement
const zoomVal = document.getElementById('zoom-val')!
zoomSlider.addEventListener('input', () => {
  const z = parseFloat(zoomSlider.value)
  zoomVal.textContent = z.toFixed(1)
  map.setCamera({ zoom: z })
})
map.on('move', (s: any) => {
  zoomSlider.value = String(s.zoom.toFixed(1))
  zoomVal.textContent = s.zoom.toFixed(1)
})

status.textContent = 'Ready'
