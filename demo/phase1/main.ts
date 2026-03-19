import { createRenderer } from '../../src/mini/renderer/index.ts'
import { MapGL } from '../../src/mini/core/map.ts'
import { BackgroundLayer } from '../../src/mini/layers/background.ts'

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
const map = new MapGL({ renderer, initialCamera: { zoom: 5 } })

const bg = new BackgroundLayer({ color: '#3388ff', opacity: 1 }) as BackgroundLayer & { id: string }
bg.id = 'background'
map.addLayer(bg)
status.textContent = 'Ready'

const colorInput = document.getElementById('color') as HTMLInputElement
const opacityInput = document.getElementById('opacity') as HTMLInputElement
const opacityVal = document.getElementById('opacity-val')!
const zoomInput = document.getElementById('zoom') as HTMLInputElement
const zoomVal = document.getElementById('zoom-val')!

function updateBackground() {
  bg.color = colorInput.value
  bg.opacity = parseFloat(opacityInput.value)
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
