// demo/phase-2-raster.ts
import { createRenderer } from '../src/mini/renderer/index.ts'
import { MapGL } from '../src/mini/core/map.ts'
import { RasterLayer } from '../src/mini/layers/raster.ts'
import type { SourceDefinition } from '../src/mini/core/renderer-api.ts'

interface RasterSourceDefinition extends SourceDefinition {
  type: 'raster'
  url: string
  tileSize?: number
}

async function main() {
  const canvas = document.getElementById('map') as HTMLCanvasElement

  // Size canvas to its CSS container
  const container = canvas.parentElement!
  canvas.width = container.clientWidth
  canvas.height = container.clientHeight

  const renderer = await createRenderer(canvas)
  const map = new MapGL({ renderer })

  map.addSource('osm', {
    type: 'raster',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    tileSize: 256,
  } as RasterSourceDefinition)

  map.addLayer(new RasterLayer({ source: 'osm', opacity: 1 }))

  // Initial camera: Amsterdam
  map.setCamera({
    center: { lng: 4.9, lat: 52.37 },
    zoom: 10,
    bearing: 0,
    pitch: 0,
    groundElevation: 0,
  })

  // Zoom slider
  const zoomSlider = document.getElementById('zoom-slider') as HTMLInputElement
  const zoomValue = document.getElementById('zoom-value') as HTMLSpanElement

  zoomSlider.addEventListener('input', () => {
    const zoom = parseFloat(zoomSlider.value)
    zoomValue.textContent = zoom.toFixed(1)
    map.setCamera({ zoom })
  })

  // Handle resize
  window.addEventListener('resize', () => {
    canvas.width = container.clientWidth
    canvas.height = container.clientHeight
    renderer.resize(canvas.width, canvas.height)
  })
}

main().catch(console.error)
