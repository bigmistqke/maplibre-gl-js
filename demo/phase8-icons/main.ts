// demo/phase8-icons/main.ts
import { createRenderer } from '../../src/modular/renderer/index.ts'
import { MapGL } from '../../src/modular/core/map.ts'
import { BackgroundLayer } from '../../src/modular/layers/background.ts'
import { FillLayer } from '../../src/modular/layers/fill.ts'
import { ImageManager } from '../../src/modular/layers/symbol/image-manager.ts'
import { IconLayer } from '../../src/modular/layers/symbol/icon-layer.ts'

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

// ImageManager — fetches sprite from local demo assets
const images = new ImageManager({ url: './sprite' })

// IconLayer — one dot per country centroid (NAME field won't match sprite entries,
// worker falls back to 'default' icon for all features)
const iconLayer = new IconLayer({
  source: 'openmaptiles',
  sourceLayer: 'centroids',
  iconField: 'NAME',
  images,
  opacity: 1,
})

map.addLayer(iconLayer)

status.textContent = 'Ready — icons from POI layer'

// Controls
const zoomInput = document.getElementById('zoom') as HTMLInputElement
const zoomVal = document.getElementById('zoom-val')!
const opacityInput = document.getElementById('opacity') as HTMLInputElement
const opacityVal = document.getElementById('opacity-val')!

zoomInput.addEventListener('input', () => {
  map.setCamera({ zoom: parseFloat(zoomInput.value) })
  zoomVal.textContent = parseFloat(zoomInput.value).toFixed(1)
})

map.on('move', (state: { zoom: number }) => {
  zoomInput.value = String(state.zoom.toFixed(1))
  zoomVal.textContent = state.zoom.toFixed(1)
})

opacityInput.addEventListener('input', () => {
  opacityVal.textContent = parseFloat(opacityInput.value).toFixed(1)
  // IconLayer doesn't support live opacity update yet
  // In a real app, you'd add a setOpacity() method or recreate the layer
})
