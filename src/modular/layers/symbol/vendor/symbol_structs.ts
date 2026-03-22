import { defineStruct } from '../../../core/struct-array.ts'

export const SymbolLineVertexLayout = defineStruct({
  x: 'int16',
  y: 'int16',
  tileUnitDistanceFromAnchor: 'int16',
})

export const GlyphOffsetLayout = defineStruct({
  offsetX: 'float32',
})

export const DynamicLayoutLayout = defineStruct({
  ax: 'float32',
  ay: 'float32',
  angle: 'float32',
})
