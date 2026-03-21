import { Map, type RasterTileSource } from 'maplibre-gl-reference'
import 'maplibre-gl-reference/dist/maplibre-gl.css'

const SOURCES: Record<string, string> = {
  osm: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  terrain: 'https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg',
}

const status = document.getElementById('status')!

const map = new Map({
  container: 'map',
  style: {
    version: 8,
    sources: {
      raster: {
        type: 'raster',
        tiles: [SOURCES.osm],
        tileSize: 256,
      },
    },
    layers: [
      {
        id: 'raster-layer',
        type: 'raster',
        source: 'raster',
      },
    ],
  },
  center: [4.9, 52.37],
  zoom: 5,
})

map.on('load', () => {
  status.textContent = 'Ready — MapLibre GL JS'
})

// Controls
const sourceSelect = document.getElementById('source') as HTMLSelectElement
const zoomInput = document.getElementById('zoom') as HTMLInputElement
const zoomVal = document.getElementById('zoom-val')!

sourceSelect.addEventListener('change', () => {
  const src = map.getSource('raster') as RasterTileSource
  src.setTiles([SOURCES[sourceSelect.value]])
})

zoomInput.addEventListener('input', () => {
  const zoom = parseFloat(zoomInput.value)
  map.setZoom(zoom)
  zoomVal.textContent = zoom.toFixed(1)
})

map.on('zoom', () => {
  const z = map.getZoom()
  zoomInput.value = z.toFixed(1)
  zoomVal.textContent = z.toFixed(1)
})
