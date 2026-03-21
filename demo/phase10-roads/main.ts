// demo/phase10-roads/main.ts
// Road name labels following curved road geometry
import { createRenderer } from '../../src/modular/renderer/index.ts'
import { MapGL } from '../../src/modular/core/map.ts'
import { BackgroundLayer } from '../../src/modular/layers/background.ts'
import { FillLayer } from '../../src/modular/layers/fill.ts'
import { LineLayer } from '../../src/modular/layers/line.ts'
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
    // Amsterdam — lots of curved roads and canals
    center: { lng: 4.9, lat: 52.37 },
    zoom: 13,
    bearing: 0,
    pitch: 0,
    groundElevation: 0,
  },
})
;(window as any).__map = map

// Free OpenMapTiles-compatible vector tiles from versatiles.org
const tileUrl = 'https://tiles.versatiles.org/tiles/osm/{z}/{x}/{y}'

map.addLayer(new BackgroundLayer({ color: '#f0ede8', opacity: 1 }))

// Tile source for fill + line layers
map.addSource('openmaptiles', {
  type: 'vector',
  url: tileUrl,
  minZoom: 0,
  maxZoom: 14,
})

// Water fill
map.addLayer(new FillLayer({
  source: 'openmaptiles',
  sourceLayer: 'water_polygons',
  color: '#c8dff0',
  opacity: 1,
}))

// Land
map.addLayer(new FillLayer({
  source: 'openmaptiles',
  sourceLayer: 'land',
  color: '#e0ead0',
  opacity: 0.3,
}))

// Streets — thin lines
map.addLayer(new LineLayer({
  source: 'openmaptiles',
  sourceLayer: 'streets',
  color: '#cccccc',
  opacity: 0.8,
}))

// Road name labels following the road curves
// Versatiles uses 'street_labels' (line features with name property)
const lineTextLayer = new LineTextLayer({
  source: 'road-names',
  sourceLayer: 'street_labels',
  textField: '{name}',
  fontstack: 'Open Sans Regular',
  fontSize: 12,
  color: '#555555',
  opacity: 1,
  glyphUrl: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
})

// Dedicated source for road name labels
const { workerService } = lineTextLayer
map.addSource('road-names', {
  type: 'vector',
  url: tileUrl,
  minZoom: 0,
  maxZoom: 14,
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
    destroy() {},
  },
})

map.addLayer(lineTextLayer)

status.textContent = 'Ready — road name labels'

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
  const size = parseInt(fontSizeInput.value)
  fontSizeVal.textContent = size + 'px'
  lineTextLayer.setFontSize(size)
})
