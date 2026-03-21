import { Map } from 'maplibre-gl-reference'
import 'maplibre-gl-reference/dist/maplibre-gl.css'

const status = document.getElementById('status')!

const map = new Map({
  container: 'map',
  style: {
    version: 8,
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
    sources: {
      versatiles: {
        type: 'vector',
        tiles: ['https://tiles.versatiles.org/tiles/osm/{z}/{x}/{y}'],
        maxzoom: 14,
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#f0ede8' },
      },
      {
        id: 'water',
        type: 'fill',
        source: 'versatiles',
        'source-layer': 'water_polygons',
        paint: { 'fill-color': '#c8dff0' },
      },
      {
        id: 'land',
        type: 'fill',
        source: 'versatiles',
        'source-layer': 'land',
        paint: { 'fill-color': '#e0ead0', 'fill-opacity': 0.3 },
      },
      {
        id: 'streets',
        type: 'line',
        source: 'versatiles',
        'source-layer': 'streets',
        paint: { 'line-color': '#cccccc', 'line-opacity': 0.8 },
      },
      {
        id: 'street-labels',
        type: 'symbol',
        source: 'versatiles',
        'source-layer': 'street_labels',
        layout: {
          'text-field': ['get', 'name'],
          'text-font': ['Open Sans Regular'],
          'text-size': 12,
          'symbol-placement': 'line',
        },
        paint: {
          'text-color': '#555555',
        },
      },
    ],
  },
  center: [4.9, 52.37],
  zoom: 14,
})

map.on('load', () => {
  status.textContent = 'Ready — MapLibre GL JS'
})

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
