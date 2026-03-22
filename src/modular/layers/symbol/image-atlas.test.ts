// src/modular/layers/symbol/image-atlas.test.ts
import { describe, it, expect } from 'vitest'
import { buildAtlas } from '@modular/layers/symbol/image-atlas'
import type { SpriteData } from '@modular/layers/symbol/icon-types'

function makeSpriteImage(w: number, h: number, fill: [number, number, number, number]): ImageData {
  const img = new ImageData(w, h)
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i]     = fill[0]
    img.data[i + 1] = fill[1]
    img.data[i + 2] = fill[2]
    img.data[i + 3] = fill[3]
  }
  return img
}

describe('buildAtlas', () => {
  it('returns an AtlasResult with imageData, entries, and dimensions', () => {
    const spriteData: SpriteData = {
      'marker': { x: 0, y: 0, width: 8, height: 8 },
    }
    const spriteImage = makeSpriteImage(8, 8, [255, 0, 0, 255])
    const result = buildAtlas(spriteData, spriteImage)

    expect(result.imageData).toBeInstanceOf(ImageData)
    expect(result.entries).toHaveProperty('marker')
    expect(result.atlasWidth).toBeGreaterThan(0)
    expect(result.atlasHeight).toBeGreaterThan(0)
  })

  it('atlas has at least the padded dimensions of the sprite entry', () => {
    const spriteData: SpriteData = {
      'icon': { x: 0, y: 0, width: 16, height: 16 },
    }
    const spriteImage = makeSpriteImage(16, 16, [0, 255, 0, 255])
    const result = buildAtlas(spriteData, spriteImage)

    // 16px + 1px padding on each side = minimum 18px
    expect(result.atlasWidth).toBeGreaterThanOrEqual(18)
    expect(result.atlasHeight).toBeGreaterThanOrEqual(18)
  })

  it('entry atlasX/atlasY accounts for 1px padding', () => {
    const spriteData: SpriteData = {
      'dot': { x: 0, y: 0, width: 4, height: 4 },
    }
    const spriteImage = makeSpriteImage(4, 4, [0, 0, 255, 255])
    const result = buildAtlas(spriteData, spriteImage)

    // atlasX and atlasY are after padding, so >= 1
    expect(result.entries['dot'].atlasX).toBeGreaterThanOrEqual(1)
    expect(result.entries['dot'].atlasY).toBeGreaterThanOrEqual(1)
  })

  it('entry width and height match the sprite data dimensions', () => {
    const spriteData: SpriteData = {
      'pin': { x: 0, y: 0, width: 12, height: 20 },
    }
    const spriteImage = makeSpriteImage(12, 20, [128, 64, 32, 255])
    const result = buildAtlas(spriteData, spriteImage)

    expect(result.entries['pin'].width).toBe(12)
    expect(result.entries['pin'].height).toBe(20)
  })

  it('copies pixel data from sprite sheet into atlas at correct position', () => {
    const spriteData: SpriteData = {
      'red': { x: 0, y: 0, width: 2, height: 2 },
    }
    // 2x2 sprite, all red
    const spriteImage = makeSpriteImage(2, 2, [255, 0, 0, 255])
    const result = buildAtlas(spriteData, spriteImage)

    const { atlasX, atlasY } = result.entries['red']
    const { atlasWidth, imageData } = result

    // Check top-left pixel of the sprite in the atlas
    const idx = (atlasY * atlasWidth + atlasX) * 4
    expect(imageData.data[idx]).toBe(255)     // R
    expect(imageData.data[idx + 1]).toBe(0)   // G
    expect(imageData.data[idx + 2]).toBe(0)   // B
    expect(imageData.data[idx + 3]).toBe(255) // A
  })

  it('handles multiple sprites without overlap', () => {
    const spriteData: SpriteData = {
      'a': { x: 0, y: 0, width: 8, height: 8 },
      'b': { x: 8, y: 0, width: 8, height: 8 },
    }
    const spriteImage = makeSpriteImage(16, 8, [200, 100, 50, 255])
    const result = buildAtlas(spriteData, spriteImage)

    expect(result.entries).toHaveProperty('a')
    expect(result.entries).toHaveProperty('b')

    const a = result.entries['a']
    const b = result.entries['b']

    // The two entries must not overlap (check bounding boxes)
    const aRight = a.atlasX + a.width
    const bRight = b.atlasX + b.width
    const aBottom = a.atlasY + a.height
    const bBottom = b.atlasY + b.height

    const overlap =
      a.atlasX < bRight && aRight > b.atlasX &&
      a.atlasY < bBottom && aBottom > b.atlasY

    expect(overlap).toBe(false)
  })

  it('returns a non-empty atlas when spriteData is empty', () => {
    const result = buildAtlas({}, new ImageData(1, 1))
    expect(result.atlasWidth).toBeGreaterThan(0)
    expect(result.atlasHeight).toBeGreaterThan(0)
  })
})
