import { Map } from 'maplibre-gl-reference'
import 'maplibre-gl-reference/dist/maplibre-gl.css'

const status = document.getElementById('status')!

const map = new Map({
  container: 'map',
  style: {
    version: 8,
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    sources: {
      openmaptiles: {
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
          'background-color': '#f8f4f0',
        },
      },
      {
        id: 'land',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'land',
        paint: {
          'fill-color': '#e8e4e0',
        },
      },
      {
        id: 'countries',
        type: 'fill',
        source: 'openmaptiles',
        'source-layer': 'countries',
        paint: {
          'fill-color': '#ede8e3',
        },
      },
      {
        id: 'line-labels',
        type: 'symbol',
        source: 'openmaptiles',
        'source-layer': 'geolines',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': 12,
          'symbol-placement': 'line',
        },
        paint: {
          'text-color': '#444444',
        },
      },
    ],
  },
  center: [0, 20],
  zoom: 3,
})

map.on('load', () => {
  status.textContent = 'Ready — MapLibre GL JS'
})

// Controls
const zoomInput = document.getElementById('zoom') as HTMLInputElement
const zoomVal = document.getElementById('zoom-val')!
const fontSizeInput = document.getElementById('font-size') as HTMLInputElement
const fontSizeVal = document.getElementById('font-size-val')!

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

fontSizeInput.addEventListener('input', () => {
  const size = parseFloat(fontSizeInput.value)
  map.setLayoutProperty('line-labels', 'text-size', size)
  fontSizeVal.textContent = size + 'px'
})
