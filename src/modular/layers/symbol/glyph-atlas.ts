// src/modular/layers/symbol/glyph-atlas.ts
import potpack from 'potpack'
import type { GlyphMap, GlyphPositions, StyleGlyph } from './types.ts'

const PADDING = 1

export type AtlasImage = { width: number; height: number; data: Uint8Array }

export class GlyphAtlas {
  readonly image: AtlasImage
  readonly positions: GlyphPositions

  constructor(stacks: GlyphMap) {
    const positions: GlyphPositions = {}
    const bins: Array<{ x: number; y: number; w: number; h: number; stack: string; id: number }> = []

    for (const stack in stacks) {
      const glyphs = stacks[stack]
      positions[stack] = {}
      for (const idStr in glyphs) {
        const id = +idStr
        const src = glyphs[id]
        if (!src || src.bitmap.width === 0 || src.bitmap.height === 0) continue
        const bin = { x: 0, y: 0, w: src.bitmap.width + 2 * PADDING, h: src.bitmap.height + 2 * PADDING, stack, id }
        bins.push(bin)
        positions[stack][id] = { rect: bin, metrics: src.metrics }
      }
    }

    const { w, h } = potpack(bins)
    const width = w || 1
    const height = h || 1
    const data = new Uint8Array(width * height)

    for (const stack in stacks) {
      const glyphs = stacks[stack]
      for (const idStr in glyphs) {
        const id = +idStr
        const src = glyphs[id]
        if (!src || src.bitmap.width === 0 || src.bitmap.height === 0) continue
        const pos = positions[stack][id]
        const { x: bx, y: by } = pos.rect
        // Copy alpha bytes row by row into atlas, offset by PADDING
        const bw = src.bitmap.width
        const bh = src.bitmap.height
        for (let row = 0; row < bh; row++) {
          const srcOff = row * bw
          const dstOff = (by + PADDING + row) * width + (bx + PADDING)
          data.set(src.bitmap.data.subarray(srcOff, srcOff + bw), dstOff)
        }
      }
    }

    this.image = { width, height, data }
    this.positions = positions
  }
}
