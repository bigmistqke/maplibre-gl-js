// demo/phase10/main.ts
import { createRenderer } from '../../src/modular/renderer/index.ts'
import { MapGLDemo as MapGL } from '../demo-map.ts'
import { BackgroundLayer } from '../../src/modular/layers/background.ts'
import { FillLayer } from '../../src/modular/layers/fill.ts'
import { LineTextLayer } from '../../src/modular/layers/symbol/line-text-layer.ts'

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
    center: { lng: 0, lat: 20 },
    zoom: 3,
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

map.addLayer(new FillLayer({
  source: 'openmaptiles',
  sourceLayer: 'countries',
  color: '#ede8e3',
  opacity: 1,
}))

// LineTextLayer — renders road/river name labels along line geometry
// The worker service fetches tile PBFs independently and runs line label placement.
// Register the layer's workerService as the tileService for a dedicated source so
// the tile manager drives tile requests with the correct URL template.
const lineTextLayer = new LineTextLayer({
  source: 'line-text-source',
  sourceLayer: 'geolines',
  textField: '{name}',
  fontstack: 'Open Sans Regular',
  fontSize: 12,
  color: '#444444',
  opacity: 1,
  glyphUrl: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
})

// Register a dedicated vector source backed by the line text worker.
// The tile manager will call workerService.request(tileID, url) for each visible tile.
// LineTextWorkerService.request() accepts (key, url, textField, sourceLayer, fontstack, fontSize).
// We adapt by providing a thin TileService wrapper that passes the layer's fixed parameters.
const tileUrl = 'https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf'
const { workerService } = lineTextLayer

map.addSource('line-text-source', {
  type: 'vector',
  url: tileUrl,
  minZoom: 0,
  maxZoom: 4,
  tileService: {
    async request(_tileID: { key: string }, url: string) {
      try {
        const res = await fetch(url)
        if (!res.ok) return []
        const buf = await res.arrayBuffer()
        return [buf] as Transferable[]
      } catch {
        return []
      }
    },
    cancel(key: string) {
      workerService.cancel(key)
    },
    destroy() {
      // workerService lifecycle is owned by lineTextLayer
    },
  },
})

map.addLayer(lineTextLayer)

status.textContent = 'Ready — line text labels'

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
  fontSizeVal.textContent = fontSizeInput.value + 'px'
})
