import { createRenderer } from '../../src/modular/renderer/index.ts'
import { MapGL } from '../../src/modular/core/map.ts'
import { BackgroundLayer } from '../../src/modular/layers/background.ts'
import { RasterLayer } from '../../src/modular/layers/raster.ts'
import { RasterTileService } from '../../src/modular/layers/raster.ts'

const SOURCES: Record<string, string> = {
  osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  satellite: 'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg',
}

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
  initialCamera: { center: { lng: 4.9, lat: 52.37 }, zoom: 5 },
})

map.addLayer(new BackgroundLayer({ color: '#e5e3df', opacity: 1 }))

// Phase 2: main-thread RasterTileService (explicit, no worker)
map.addSource('tiles', {
  type: 'raster',
  url: SOURCES.osm,
  tileSize: 256,
  tileService: new RasterTileService(),
})
map.addLayer(new RasterLayer({ source: 'tiles', opacity: 1 }))
status.textContent = 'Ready — main-thread tile fetch'

const sourceSelect = document.getElementById('source') as HTMLSelectElement
const opacityInput = document.getElementById('opacity') as HTMLInputElement
const opacityVal = document.getElementById('opacity-val')!
const zoomInput = document.getElementById('zoom') as HTMLInputElement
const zoomVal = document.getElementById('zoom-val')!

sourceSelect.addEventListener('change', () => {
  map.removeLayer('tiles')
  map.removeSource('tiles')
  map.addSource('tiles', {
    type: 'raster',
    url: SOURCES[sourceSelect.value],
    tileSize: 256,
    tileService: new RasterTileService(),
  })
  map.addLayer(new RasterLayer({ source: 'tiles', opacity: parseFloat(opacityInput.value) }))
})

opacityInput.addEventListener('input', () => {
  opacityVal.textContent = parseFloat(opacityInput.value).toFixed(2)
  map.removeLayer('tiles')
  map.addLayer(new RasterLayer({ source: 'tiles', opacity: parseFloat(opacityInput.value) }))
})

zoomInput.addEventListener('input', () => {
  const zoom = parseFloat(zoomInput.value)
  map.setCamera({ zoom })
  zoomVal.textContent = zoom.toFixed(1)
})

map.on('move', (state: { zoom: number }) => {
  zoomInput.value = String(state.zoom.toFixed(1))
  zoomVal.textContent = state.zoom.toFixed(1)
})
