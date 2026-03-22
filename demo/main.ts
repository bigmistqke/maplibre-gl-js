import { createRenderer } from '../src/modular/renderer/index.ts'
import { MapGLDemo as MapGL } from './demo-map.ts'
import { BackgroundLayer } from '../src/modular/layers/background.ts'

const canvas = document.getElementById('map') as HTMLCanvasElement
const status = document.getElementById('status')!

// Size canvas to fill its container
function resize() {
  const rect = canvas.getBoundingClientRect()
  canvas.width = rect.width * devicePixelRatio
  canvas.height = rect.height * devicePixelRatio
}
resize()
window.addEventListener('resize', resize)

// Boot
const renderer = await createRenderer(canvas)
const map = new MapGL({ renderer, initialCamera: { zoom: 5 } })

// BackgroundLayer — give it an explicit id so we can remove/re-add it
const bg = new BackgroundLayer({ color: '#3388ff', opacity: 1 }) as BackgroundLayer & { id: string }
bg.id = 'background'
map.addLayer(bg)

status.textContent = 'Ready'

// Controls
const colorInput = document.getElementById('color') as HTMLInputElement
const opacityInput = document.getElementById('opacity') as HTMLInputElement
const opacityVal = document.getElementById('opacity-val')!
const zoomInput = document.getElementById('zoom') as HTMLInputElement
const zoomVal = document.getElementById('zoom-val')!

function updateBackground() {
  // Mutate directly — StyleEvaluator reads color/opacity off the layer instance
  bg.color = colorInput.value
  bg.opacity = parseFloat(opacityInput.value)
  // Re-add to trigger markDirty (remove+add preserves order for Phase 1)
  map.removeLayer('background')
  map.addLayer(bg)
  opacityVal.textContent = bg.opacity.toFixed(2)
}

colorInput.addEventListener('input', updateBackground)
opacityInput.addEventListener('input', updateBackground)

zoomInput.addEventListener('input', () => {
  const zoom = parseFloat(zoomInput.value)
  map.setCamera({ zoom })
  zoomVal.textContent = zoom.toFixed(1)
})
