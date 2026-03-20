import { defineStruct, type StructArray } from '../../core/struct-array.ts'

// ---- Glyph types ----

export type GlyphMetrics = {
  width: number
  height: number
  left: number
  top: number
  advance: number
}

export type StyleGlyph = {
  id: number
  bitmap: { width: number; height: number; data: Uint8Array }
  metrics: GlyphMetrics
}

/** Keyed by fontstack → codepoint → glyph (or null if missing from font) */
export type GlyphMap = { [stack: string]: { [id: number]: StyleGlyph | null } }

/** Position of a glyph in the packed atlas image */
export type GlyphPosition = {
  rect: { x: number; y: number; w: number; h: number }
  metrics: GlyphMetrics
}

/** Atlas positions keyed by fontstack → codepoint */
export type GlyphPositions = { [stack: string]: { [id: number]: GlyphPosition } }

// ---- Vertex layout ----

/**
 * Per-vertex SDF glyph layout:
 *   ax, ay  — anchor position in tile coords (int16, MVT [0..4096])
 *   ox, oy  — glyph pixel offset from anchor (int16, stored ×32 fixed-point)
 *   u,  v   — atlas texel coordinate (uint16, in atlas pixels — normalized to [0,1] on CPU before upload)
 *
 * Stride: 2+2+2+2+2+2 = 12 bytes
 */
export const GlyphVertexLayout = defineStruct({
  ax: 'int16',
  ay: 'int16',
  ox: 'int16',
  oy: 'int16',
  u:  'uint16',
  v:  'uint16',
})

// ---- Tile data produced by worker ----

export type SymbolTileData = {
  /** Interleaved vertex data matching GlyphVertexLayout */
  vertices: ArrayBuffer
  /** Uint16 index data */
  indices: ArrayBuffer
  /** Number of indices (= drawElements count) */
  count: number
  /** Label anchor positions in tile coords (for debugging / collision) */
  labelPositions: { x: number; y: number }[]
}
