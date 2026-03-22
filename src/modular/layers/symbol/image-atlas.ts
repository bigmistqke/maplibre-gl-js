// src/modular/layers/symbol/image-atlas.ts
import potpack from 'potpack'
import type { SpriteData, SpriteEntry } from '@modular/layers/symbol/icon-types'

const PADDING = 1

export type AtlasEntry = {
  /** Top-left pixel coordinate in the atlas texture */
  atlasX: number
  atlasY: number
  /** Dimensions of the image in the atlas (excluding padding) */
  width: number
  height: number
}

export type AtlasResult = {
  /** Packed RGBA pixel data suitable for gl.texImage2D */
  imageData: ImageData
  /** Lookup from sprite name to atlas position */
  entries: { [name: string]: AtlasEntry }
  atlasWidth: number
  atlasHeight: number
}

type PotpackBox = { x: number; y: number; w: number; h: number; name: string }

/**
 * Pack all entries from a sprite sheet into a new atlas ImageData.
 * Uses potpack for bin-packing. Adds 1px transparent padding around each entry
 * to avoid GL_LINEAR bleeding between adjacent sprites.
 */
export function buildAtlas(spriteData: SpriteData, spriteImage: ImageData): AtlasResult {
  const names = Object.keys(spriteData)

  // Build potpack bins (padded)
  const bins: PotpackBox[] = names.map(name => {
    const e = spriteData[name]
    return { x: 0, y: 0, w: e.width + 2 * PADDING, h: e.height + 2 * PADDING, name }
  })

  const { w: atlasWidth, h: atlasHeight } = potpack(bins)
  const atlasData = new ImageData(atlasWidth || 1, atlasHeight || 1)

  const entries: { [name: string]: AtlasEntry } = {}

  for (const bin of bins) {
    const src = spriteData[bin.name]
    const destX = bin.x + PADDING
    const destY = bin.y + PADDING

    // Copy pixel rows from spriteImage into atlasData
    for (let row = 0; row < src.height; row++) {
      const srcRowStart = ((src.y + row) * spriteImage.width + src.x) * 4
      const dstRowStart = ((destY + row) * atlasWidth + destX) * 4
      for (let col = 0; col < src.width; col++) {
        const s = srcRowStart + col * 4
        const d = dstRowStart + col * 4
        atlasData.data[d]     = spriteImage.data[s]
        atlasData.data[d + 1] = spriteImage.data[s + 1]
        atlasData.data[d + 2] = spriteImage.data[s + 2]
        atlasData.data[d + 3] = spriteImage.data[s + 3]
      }
    }

    entries[bin.name] = {
      atlasX: destX,
      atlasY: destY,
      width: src.width,
      height: src.height,
    }
  }

  return { imageData: atlasData, entries, atlasWidth: atlasWidth || 1, atlasHeight: atlasHeight || 1 }
}
