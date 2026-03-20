// src/modular/core/placement-participant.ts
// Compile-time only — erased at runtime. Zero bundle cost when unused.

export type SymbolBucketData = {
  /** Tile cache key — used by Placement to key per-label opacity state */
  tileKey: string
  /** Label anchor centres in screen pixels, one per placed label */
  anchors: Array<{ x: number; y: number }>
  /** Screen-pixel AABBs [x1, y1, x2, y2] per label — parallel with anchors */
  boxes: Array<[number, number, number, number]>
}

export interface PlacementParticipant {
  getSymbolBuckets(): SymbolBucketData[]
  setOpacity(tileKey: string, opacity: Float32Array): void
}
