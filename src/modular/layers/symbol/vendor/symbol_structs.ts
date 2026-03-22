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

export const CollisionBoxLayout = defineStruct({
  anchorPointX: 'int16',
  anchorPointY: 'int16',
  x1: 'int16',
  y1: 'int16',
  x2: 'int16',
  y2: 'int16',
  featureIndex: 'uint32',
  sourceLayerIndex: 'uint16',
  bucketIndex: 'uint16',
})

export const SymbolInstanceLayout = defineStruct({
  anchorX: 'int16',
  anchorY: 'int16',
  rightJustifiedTextSymbolIndex: 'int16',
  centerJustifiedTextSymbolIndex: 'int16',
  leftJustifiedTextSymbolIndex: 'int16',
  verticalPlacedTextSymbolIndex: 'int16',
  placedIconSymbolIndex: 'int16',
  verticalPlacedIconSymbolIndex: 'int16',
  key: 'uint16',
  textBoxStartIndex: 'uint16',
  textBoxEndIndex: 'uint16',
  verticalTextBoxStartIndex: 'uint16',
  verticalTextBoxEndIndex: 'uint16',
  iconBoxStartIndex: 'uint16',
  iconBoxEndIndex: 'uint16',
  verticalIconBoxStartIndex: 'uint16',
  verticalIconBoxEndIndex: 'uint16',
  featureIndex: 'uint16',
  numHorizontalGlyphVertices: 'uint16',
  numVerticalGlyphVertices: 'uint16',
  numIconVertices: 'uint16',
  numVerticalIconVertices: 'uint16',
  useRuntimeCollisionCircles: 'uint16',
  crossTileID: 'uint32',
  textBoxScale: 'float32',
  collisionCircleDiameter: 'float32',
  textAnchorOffsetStartIndex: 'uint16',
  textAnchorOffsetEndIndex: 'uint16',
})

export const PlacedSymbolLayout = defineStruct({
  anchorX: 'int16',
  anchorY: 'int16',
  glyphStartIndex: 'uint16',
  numGlyphs: 'uint16',
  vertexStartIndex: 'uint32',
  lineStartIndex: 'uint32',
  lineLength: 'uint32',
  segment: 'uint16',
  lowerSize: 'uint16',
  upperSize: 'uint16',
  lineOffsetX: 'float32',
  lineOffsetY: 'float32',
  writingMode: 'uint8',
  placedOrientation: 'uint8',
  hidden: 'uint8',
  crossTileID: 'uint32',
  associatedIconIndex: 'int16',
})

export const TextAnchorOffsetLayout = defineStruct({
  textAnchor: 'uint16',
  textOffset0: 'float32',
  textOffset1: 'float32',
})

export const CollisionVertexLayout = defineStruct({
  placed: 'int16',
  notUsed: 'int16',
  shiftX: 'float32',
  shiftY: 'float32',
})

export const OpacityLayout = defineStruct({
  targetOpacity: 'uint32',
})
