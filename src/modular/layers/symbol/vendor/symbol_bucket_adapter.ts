import { createStructArray } from '@modular/core/struct-array.ts'
import { TILE_EXTENT, TILE_SIZE } from '@modular/core/constants.ts'
import {
  SymbolLineVertexLayout,
  GlyphOffsetLayout,
  DynamicLayoutLayout,
  PlacedSymbolLayout,
  SymbolInstanceLayout,
  CollisionBoxLayout,
  CollisionVertexLayout,
  OpacityLayout,
} from '@modular/layers/symbol/vendor/symbol_structs.ts'

class SymbolBuffers {
  placedSymbolArray = createStructArray(PlacedSymbolLayout)
  dynamicLayoutVertexArray = createStructArray(DynamicLayoutLayout)
  opacityVertexArray = createStructArray(OpacityLayout)
}

export class SymbolBucketAdapter {
  symbolInstances = createStructArray(SymbolInstanceLayout)
  text = new SymbolBuffers()
  icon = new SymbolBuffers()
  glyphOffsetArray = createStructArray(GlyphOffsetLayout)
  lineVertexArray = createStructArray(SymbolLineVertexLayout)
  collisionBoxArray = createStructArray(CollisionBoxLayout)

  textCollisionBox = {
    collisionVertexArray: createStructArray(CollisionVertexLayout),
  }
  iconCollisionBox = {
    collisionVertexArray: createStructArray(CollisionVertexLayout),
  }

  overscaling: number
  tilePixelRatio: number
  textSizeData: any // STUB: will be populated by worker
  iconSizeData: any // STUB: will be populated by worker

  constructor(overscaling = 1) {
    this.overscaling = overscaling
    this.tilePixelRatio = TILE_EXTENT / (TILE_SIZE * overscaling)
    this.textSizeData = { kind: 'constant', layoutSize: 12 } // STUB: default
    this.iconSizeData = { kind: 'constant', layoutSize: 1 } // STUB: default
  }
}
