import { StructArray } from '../../../core/struct-array.ts'
import { TILE_EXTENT, TILE_SIZE } from '../../../core/constants.ts'
import {
  SymbolLineVertexLayout,
  GlyphOffsetLayout,
  DynamicLayoutLayout,
  PlacedSymbolLayout,
  SymbolInstanceLayout,
  CollisionBoxLayout,
  CollisionVertexLayout,
  OpacityLayout,
} from './symbol_structs.ts'

class SymbolBuffers {
  placedSymbolArray = new StructArray(PlacedSymbolLayout)
  dynamicLayoutVertexArray = new StructArray(DynamicLayoutLayout)
  opacityVertexArray = new StructArray(OpacityLayout)
}

export class SymbolBucketAdapter {
  symbolInstances = new StructArray(SymbolInstanceLayout)
  text = new SymbolBuffers()
  icon = new SymbolBuffers()
  glyphOffsetArray = new StructArray(GlyphOffsetLayout)
  lineVertexArray = new StructArray(SymbolLineVertexLayout)
  collisionBoxArray = new StructArray(CollisionBoxLayout)

  textCollisionBox = {
    collisionVertexArray: new StructArray(CollisionVertexLayout),
  }
  iconCollisionBox = {
    collisionVertexArray: new StructArray(CollisionVertexLayout),
  }

  overscaling: number
  tilePixelRatio: number
  textSizeData: any // STUB: will be populated by worker

  constructor(overscaling = 1) {
    this.overscaling = overscaling
    this.tilePixelRatio = TILE_EXTENT / (TILE_SIZE * overscaling)
    this.textSizeData = { kind: 'constant', layoutSize: 12 } // STUB: default
  }
}
