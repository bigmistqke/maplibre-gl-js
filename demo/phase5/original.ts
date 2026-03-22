import { createMapDemo } from '../demo-map.ts'
import 'maplibre-gl-reference/dist/maplibre-gl.css'

const status = document.getElementById('status')!

const map = createMapDemo({
  container: 'map',
  style: {
    version: 8,
    sources: {
      mvt: {
        type: 'vector',
        tiles: ['https://demotiles.maplibre.org/tiles/{z}/{x}/{y}.pbf'],
        maxzoom: 6,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: {
          'background-color': '#1a1a2e',
        },
      },
      {
        id: 'fill',
        type: 'fill',
        source: 'mvt',
        'source-layer': 'countries',
        paint: {
          'fill-color': '#2d4a7a',
          'fill-opacity': 0.85,
        },
      },
      {
        id: 'lines',
        type: 'line',
        source: 'mvt',
        'source-layer': 'countries',
        paint: {
          'line-color': '#5b8ed6',
          'line-opacity': 1,
        },
      },
    ],
  },
  center: [0, 20],
  zoom: 1,
})

map.on('load', () => {
  status.textContent = 'Ready — MapLibre GL JS'
})

// Controls
const zoomInput = document.getElementById('zoom') as HTMLInputElement
const zoomVal = document.getElementById('zoom-val')!

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

document.getElementById('toggle-fill')!.addEventListener('change', (e) => {
  const checked = (e.target as HTMLInputElement).checked
  map.setLayoutProperty('fill', 'visibility', checked ? 'visible' : 'none')
})

document.getElementById('toggle-lines')!.addEventListener('change', (e) => {
  const checked = (e.target as HTMLInputElement).checked
  map.setLayoutProperty('lines', 'visibility', checked ? 'visible' : 'none')
})
