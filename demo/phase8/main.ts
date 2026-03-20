// demo/phase8/main.ts
import { createRenderer } from '../../src/modular/renderer/index.ts'
import { MapGL } from '../../src/modular/core/map.ts'
import { BackgroundLayer } from '../../src/modular/layers/background.ts'
import { FillLayer } from '../../src/modular/layers/fill.ts'
import { GlyphManager } from '../../src/modular/layers/symbol/glyph-manager.ts'
import { TextLayer } from '../../src/modular/layers/symbol/text-layer.ts'

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

// Vector tile source — OpenMapTiles compatible
map.addSource('openmaptiles', {
  type: 'vector',
  url: 'https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf',
  minZoom: 0,
  maxZoom: 6,
})

map.addLayer(new FillLayer({
  source: 'openmaptiles',
  sourceLayer: 'land',
  color: '#e8e4e0',
  opacity: 1,
}))

// GlyphManager — fetches SDF glyph PBFs from MapLibre's public endpoint
const glyphs = new GlyphManager({
  url: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
})

// TextLayer — renders place names
const textLayer = new TextLayer({
  source: 'openmaptiles',
  sourceLayer: 'centroids',
  textField: '{NAME}',
  fontstack: 'Open Sans Regular',
  fontSize: 14,
  color: '#333333',
  opacity: 1,
  glyphs,
})
map.addLayer(textLayer)

status.textContent = 'Ready — text labels'

// Controls
const zoomInput = document.getElementById('zoom') as HTMLInputElement
const zoomVal = document.getElementById('zoom-val')!
const fontSizeInput = document.getElementById('font-size') as HTMLInputElement
const fontSizeVal = document.getElementById('font-size-val')!

zoomInput.addEventListener('input', () => {
  map.setCamera({ zoom: parseFloat(zoomInput.value) })
  zoomVal.textContent = parseFloat(zoomInput.value).toFixed(1)
})

map.on('move', (state: { zoom: number }) => {
  zoomInput.value = String(state.zoom.toFixed(1))
  zoomVal.textContent = state.zoom.toFixed(1)
})

fontSizeInput.addEventListener('input', () => {
  // TextLayer doesn't support live fontSize update — show value only
  // In a real app, you'd recreate the layer or add a setFontSize() method
  fontSizeVal.textContent = fontSizeInput.value + 'px'
})
