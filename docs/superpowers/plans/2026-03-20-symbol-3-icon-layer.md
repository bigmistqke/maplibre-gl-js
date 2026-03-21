# IconLayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement ImageManager + IconWorkerService + IconLayer — sprite icon rendering from vector tile features. Independent of text/glyph system.

**Architecture:** ImageManager (main thread) fetches sprite.json + sprite.png and maintains a sprite atlas WebGLTexture. IconWorkerService wraps a Comlink worker that fetches tile PBF, generates icon quads at feature centroids, and returns pre-built vertex arrays. IconLayer gets bucket data from the worker side-channel and draws.

**Tech Stack:** TypeScript strict, Vitest (unit), @mapbox/vector-tile, pbf, potpack, Comlink, StructArray (already in src/modular/core/struct-array.ts)

**Spec:** `docs/superpowers/specs/2026-03-20-symbol-design.md`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/modular/layers/symbol/icon-types.ts` | Create | Shared types and IconVertexLayout |
| `src/modular/layers/symbol/icon-types.test.ts` | Create | Unit test — stride = 12 bytes |
| `src/modular/layers/symbol/sprite-loader.ts` | Create | Fetch + parse sprite.json and sprite.png |
| `src/modular/layers/symbol/sprite-loader.test.ts` | Create | Unit tests with mock fetch |
| `src/modular/layers/symbol/image-atlas.ts` | Create | Pack sprite entries into canvas/ImageData atlas |
| `src/modular/layers/symbol/image-atlas.test.ts` | Create | Unit tests |
| `src/modular/layers/symbol/image-manager.ts` | Create | ImageManager resource provider |
| `src/modular/layers/symbol/image-manager.test.ts` | Create | Unit tests with mock fetch |
| `src/modular/layers/symbol/workers/symbol-worker-icon.ts` | Create | Comlink worker — PBF parse + icon quad generation |
| `src/modular/layers/symbol/workers/icon-worker-service.ts` | Create | Comlink wrapper around SymbolWorkerIcon |
| `src/modular/layers/symbol/icon-layer.ts` | Create | IconLayer class + shaders |
| `demo/icon-layer-demo.ts` | Create | Demo wiring |

---

## Task 1: Types + IconVertexLayout

**Goal:** Define all shared types and the `IconVertexLayout` struct schema. Verify that the stride is exactly 12 bytes (6 fields × 2 bytes each).

**Files:**
- Create: `src/modular/layers/symbol/icon-types.ts`
- Create: `src/modular/layers/symbol/icon-types.test.ts`

- [ ] **Step 1: Create `icon-types.ts`**

```ts
// src/modular/layers/symbol/icon-types.ts
import { defineStruct } from '../../core/struct-array.ts'

export type SpriteEntry = {
  x: number
  y: number
  width: number
  height: number
  pixelRatio?: number
}

export type SpriteData = { [name: string]: SpriteEntry }

export type IconTileData = {
  vertices: ArrayBuffer  // packed per IconVertexLayout, 4 verts per icon quad
  indices: ArrayBuffer   // Uint16Array, 6 indices per icon quad (two triangles)
  count: number          // number of draw indices
}

// Per-vertex layout: anchor (int16 x2) + offset (int16 x2) + tex UV (uint16 x2) = 12 bytes stride
export const IconVertexLayout = defineStruct({
  ax: 'int16',   // anchor x in tile coords (0..8192)
  ay: 'int16',   // anchor y in tile coords (0..8192)
  ox: 'int16',   // pixel offset x, stored as value * 32
  oy: 'int16',   // pixel offset y, stored as value * 32
  u:  'uint16',  // atlas UV x in atlas pixels
  v:  'uint16',  // atlas UV y in atlas pixels
})
```

- [ ] **Step 2: Create `icon-types.test.ts`**

```ts
// src/modular/layers/symbol/icon-types.test.ts
import { describe, it, expect } from 'vitest'
import { IconVertexLayout } from './icon-types.ts'

describe('IconVertexLayout', () => {
  it('has stride of 12 bytes (6 int16/uint16 fields × 2 bytes each)', () => {
    expect(IconVertexLayout.stride).toBe(12)
  })

  it('has ax at byte offset 0', () => {
    expect(IconVertexLayout.fields.ax.offset).toBe(0)
  })

  it('has ay at byte offset 2', () => {
    expect(IconVertexLayout.fields.ay.offset).toBe(2)
  })

  it('has ox at byte offset 4', () => {
    expect(IconVertexLayout.fields.ox.offset).toBe(4)
  })

  it('has oy at byte offset 6', () => {
    expect(IconVertexLayout.fields.oy.offset).toBe(6)
  })

  it('has u at byte offset 8', () => {
    expect(IconVertexLayout.fields.u.offset).toBe(8)
  })

  it('has v at byte offset 10', () => {
    expect(IconVertexLayout.fields.v.offset).toBe(10)
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/icon-types.test.ts
```

Expected: 7 tests pass, stride = 12 confirmed

- [ ] **Step 4: Type-check**

```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "icon-types"
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/modular/layers/symbol/icon-types.ts src/modular/layers/symbol/icon-types.test.ts
git commit -m "feat(modular/symbol): add icon types and IconVertexLayout (stride=12)"
```

---

## Task 2: SpriteLoader

**Goal:** Fetch `sprite.json` and `sprite.png`, return `SpriteData` (the JSON metadata) and an `ImageData` object from the PNG.

**Files:**
- Create: `src/modular/layers/symbol/sprite-loader.ts`
- Create: `src/modular/layers/symbol/sprite-loader.test.ts`

- [ ] **Step 1: Create `sprite-loader.ts`**

```ts
// src/modular/layers/symbol/sprite-loader.ts
import type { SpriteData } from './icon-types.ts'

export type SpriteResult = {
  data: SpriteData
  image: ImageData
}

/**
 * Fetch sprite.json and sprite.png from a sprite URL base (no extension).
 * E.g. url = 'https://example.com/sprite' will fetch:
 *   https://example.com/sprite.json
 *   https://example.com/sprite.png
 */
export async function loadSprite(url: string, signal?: AbortSignal): Promise<SpriteResult> {
  const [jsonRes, pngRes] = await Promise.all([
    fetch(`${url}.json`, { signal }),
    fetch(`${url}.png`, { signal }),
  ])

  if (!jsonRes.ok) throw new Error(`Sprite JSON fetch failed: HTTP ${jsonRes.status}`)
  if (!pngRes.ok) throw new Error(`Sprite PNG fetch failed: HTTP ${pngRes.status}`)

  const data = (await jsonRes.json()) as SpriteData
  const blob = await pngRes.blob()
  const bitmap = await createImageBitmap(blob)

  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height)
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(bitmap, 0, 0)
  bitmap.close()
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)

  return { data, image }
}
```

- [ ] **Step 2: Create `sprite-loader.test.ts`**

```ts
// src/modular/layers/symbol/sprite-loader.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { loadSprite } from './sprite-loader.ts'

const SPRITE_DATA = {
  'marker': { x: 0, y: 0, width: 16, height: 16, pixelRatio: 1 },
  'pin': { x: 16, y: 0, width: 24, height: 32, pixelRatio: 1 },
}

// Minimal 1x1 transparent PNG (base64)
const TRANSPARENT_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function makeMockFetch(jsonData: object, pngBytes: Uint8Array) {
  return vi.fn((url: string) => {
    if (url.endsWith('.json')) {
      return Promise.resolve(new Response(JSON.stringify(jsonData), { status: 200 }))
    }
    if (url.endsWith('.png')) {
      return Promise.resolve(new Response(pngBytes, { status: 200, headers: { 'Content-Type': 'image/png' } }))
    }
    return Promise.resolve(new Response(null, { status: 404 }))
  })
}

afterEach(() => vi.restoreAllMocks())

describe('loadSprite', () => {
  it('fetches sprite.json and sprite.png from the base URL', async () => {
    const mockFetch = makeMockFetch(SPRITE_DATA, base64ToUint8Array(TRANSPARENT_PNG_B64))
    vi.stubGlobal('fetch', mockFetch)

    await loadSprite('https://example.com/sprite')

    expect(mockFetch).toHaveBeenCalledWith('https://example.com/sprite.json', expect.any(Object))
    expect(mockFetch).toHaveBeenCalledWith('https://example.com/sprite.png', expect.any(Object))
  })

  it('returns parsed SpriteData from the JSON', async () => {
    const mockFetch = makeMockFetch(SPRITE_DATA, base64ToUint8Array(TRANSPARENT_PNG_B64))
    vi.stubGlobal('fetch', mockFetch)

    const result = await loadSprite('https://example.com/sprite')

    expect(result.data).toEqual(SPRITE_DATA)
    expect(result.data['marker'].width).toBe(16)
    expect(result.data['pin'].height).toBe(32)
  })

  it('returns an ImageData object from the PNG', async () => {
    const mockFetch = makeMockFetch(SPRITE_DATA, base64ToUint8Array(TRANSPARENT_PNG_B64))
    vi.stubGlobal('fetch', mockFetch)

    const result = await loadSprite('https://example.com/sprite')

    expect(result.image).toBeInstanceOf(ImageData)
    expect(result.image.width).toBeGreaterThan(0)
    expect(result.image.height).toBeGreaterThan(0)
  })

  it('throws on a non-ok JSON response', async () => {
    const mockFetch = vi.fn((url: string) =>
      Promise.resolve(new Response(null, { status: url.endsWith('.json') ? 404 : 200 }))
    )
    vi.stubGlobal('fetch', mockFetch)

    await expect(loadSprite('https://example.com/sprite')).rejects.toThrow('HTTP 404')
  })

  it('throws on a non-ok PNG response', async () => {
    const mockFetch = vi.fn((url: string) =>
      Promise.resolve(new Response(
        url.endsWith('.json') ? JSON.stringify(SPRITE_DATA) : null,
        { status: url.endsWith('.png') ? 500 : 200 }
      ))
    )
    vi.stubGlobal('fetch', mockFetch)

    await expect(loadSprite('https://example.com/sprite')).rejects.toThrow('HTTP 500')
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/sprite-loader.test.ts
```

Expected: 5 tests pass

- [ ] **Step 4: Type-check**

```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "sprite-loader"
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/modular/layers/symbol/sprite-loader.ts src/modular/layers/symbol/sprite-loader.test.ts
git commit -m "feat(modular/symbol): add SpriteLoader — fetch and parse sprite.json + sprite.png"
```

---

## Task 3: ImageAtlas

**Goal:** Given `SpriteData` (the JSON metadata) and the full sprite sheet `ImageData`, use `potpack` to bin-pack entries and produce an atlas `ImageData` that can be uploaded as a WebGL texture. Also expose a UV lookup by sprite name.

**Files:**
- Create: `src/modular/layers/symbol/image-atlas.ts`
- Create: `src/modular/layers/symbol/image-atlas.test.ts`

- [ ] **Step 1: Create `image-atlas.ts`**

```ts
// src/modular/layers/symbol/image-atlas.ts
import potpack from 'potpack'
import type { SpriteData, SpriteEntry } from './icon-types.ts'

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
```

- [ ] **Step 2: Create `image-atlas.test.ts`**

```ts
// src/modular/layers/symbol/image-atlas.test.ts
import { describe, it, expect } from 'vitest'
import { buildAtlas } from './image-atlas.ts'
import type { SpriteData } from './icon-types.ts'

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
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/image-atlas.test.ts
```

Expected: 7 tests pass

- [ ] **Step 4: Type-check**

```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "image-atlas"
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/modular/layers/symbol/image-atlas.ts src/modular/layers/symbol/image-atlas.test.ts
git commit -m "feat(modular/symbol): add ImageAtlas — potpack sprite bin-packing for WebGL texture"
```

---

## Task 4: ImageManager

**Goal:** Main-thread resource provider. Wraps `loadSprite` + `buildAtlas`. Exposes the packed atlas `ImageData` and per-sprite `AtlasEntry` lookup. Calls a callback when ready (used by `IconWorkerService` to push sprite metadata to the worker).

**Files:**
- Create: `src/modular/layers/symbol/image-manager.ts`
- Create: `src/modular/layers/symbol/image-manager.test.ts`

- [ ] **Step 1: Create `image-manager.ts`**

```ts
// src/modular/layers/symbol/image-manager.ts
import { loadSprite } from './sprite-loader.ts'
import { buildAtlas } from './image-atlas.ts'
import type { SpriteData } from './icon-types.ts'
import type { AtlasEntry, AtlasResult } from './image-atlas.ts'

export type ImageManagerOptions = {
  url: string
}

export type ImageReadyCallback = (spriteData: SpriteData, atlas: AtlasResult) => void

export class ImageManager {
  private _url: string
  private _spriteData: SpriteData | null = null
  private _atlas: AtlasResult | null = null
  private _callbacks: ImageReadyCallback[] = []
  private _abortController: AbortController | null = null
  private _loaded = false

  constructor(options: ImageManagerOptions) {
    this._url = options.url
  }

  /**
   * Begin loading the sprite. Safe to call multiple times — only loads once.
   * Calls onReady immediately if already loaded.
   */
  load(onReady?: ImageReadyCallback): void {
    if (onReady) {
      if (this._loaded && this._spriteData && this._atlas) {
        onReady(this._spriteData, this._atlas)
        return
      }
      this._callbacks.push(onReady)
    }

    if (this._abortController) return  // already loading

    this._abortController = new AbortController()
    loadSprite(this._url, this._abortController.signal).then(({ data, image }) => {
      this._spriteData = data
      this._atlas = buildAtlas(data, image)
      this._loaded = true
      for (const cb of this._callbacks) cb(this._spriteData, this._atlas)
      this._callbacks = []
    }).catch(() => {
      // silently ignore abort errors; re-throw real errors in debug mode
    })
  }

  /** True once sprite.json + sprite.png have been successfully loaded and packed. */
  get isLoaded(): boolean {
    return this._loaded
  }

  /** Sprite metadata, or null if not yet loaded. */
  get spriteData(): SpriteData | null {
    return this._spriteData
  }

  /** Atlas result, or null if not yet loaded. */
  get atlas(): AtlasResult | null {
    return this._atlas
  }

  /** Look up an entry in the atlas by sprite name. Returns null if not found or not loaded. */
  getEntry(name: string): AtlasEntry | null {
    return this._atlas?.entries[name] ?? null
  }

  destroy(): void {
    this._abortController?.abort()
    this._abortController = null
    this._callbacks = []
  }
}
```

- [ ] **Step 2: Create `image-manager.test.ts`**

```ts
// src/modular/layers/symbol/image-manager.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ImageManager } from './image-manager.ts'

const SPRITE_DATA = {
  'marker': { x: 0, y: 0, width: 4, height: 4, pixelRatio: 1 },
}

// Minimal 4x4 transparent PNG (base64)
const TRANSPARENT_4X4_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAADklEQVQImWNgYGD4TwABBAEBZMbVQAAAAABJRU5ErkJggg=='

function base64ToUint8Array(b64: string): Uint8Array {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function makeMockFetch() {
  const pngBytes = base64ToUint8Array(TRANSPARENT_4X4_PNG_B64)
  return vi.fn((url: string) => {
    if (url.endsWith('.json')) {
      return Promise.resolve(new Response(JSON.stringify(SPRITE_DATA), { status: 200 }))
    }
    if (url.endsWith('.png')) {
      return Promise.resolve(new Response(pngBytes, { status: 200, headers: { 'Content-Type': 'image/png' } }))
    }
    return Promise.resolve(new Response(null, { status: 404 }))
  })
}

afterEach(() => vi.restoreAllMocks())

describe('ImageManager', () => {
  it('starts in unloaded state', () => {
    const mgr = new ImageManager({ url: 'https://example.com/sprite' })
    expect(mgr.isLoaded).toBe(false)
    expect(mgr.spriteData).toBeNull()
    expect(mgr.atlas).toBeNull()
    mgr.destroy()
  })

  it('calls onReady callback when sprite loads successfully', async () => {
    vi.stubGlobal('fetch', makeMockFetch())
    const mgr = new ImageManager({ url: 'https://example.com/sprite' })

    const onReady = vi.fn()
    mgr.load(onReady)

    // Wait for microtasks
    await new Promise(r => setTimeout(r, 50))

    expect(onReady).toHaveBeenCalledOnce()
    mgr.destroy()
  })

  it('is marked as loaded after sprite is fetched', async () => {
    vi.stubGlobal('fetch', makeMockFetch())
    const mgr = new ImageManager({ url: 'https://example.com/sprite' })

    mgr.load()
    await new Promise(r => setTimeout(r, 50))

    expect(mgr.isLoaded).toBe(true)
    mgr.destroy()
  })

  it('exposes spriteData and atlas after load', async () => {
    vi.stubGlobal('fetch', makeMockFetch())
    const mgr = new ImageManager({ url: 'https://example.com/sprite' })

    mgr.load()
    await new Promise(r => setTimeout(r, 50))

    expect(mgr.spriteData).toEqual(SPRITE_DATA)
    expect(mgr.atlas).not.toBeNull()
    expect(mgr.atlas!.entries).toHaveProperty('marker')
    mgr.destroy()
  })

  it('getEntry returns AtlasEntry for known sprite name after load', async () => {
    vi.stubGlobal('fetch', makeMockFetch())
    const mgr = new ImageManager({ url: 'https://example.com/sprite' })

    mgr.load()
    await new Promise(r => setTimeout(r, 50))

    const entry = mgr.getEntry('marker')
    expect(entry).not.toBeNull()
    expect(entry!.width).toBe(4)
    expect(entry!.height).toBe(4)
    mgr.destroy()
  })

  it('getEntry returns null for unknown sprite name', async () => {
    vi.stubGlobal('fetch', makeMockFetch())
    const mgr = new ImageManager({ url: 'https://example.com/sprite' })

    mgr.load()
    await new Promise(r => setTimeout(r, 50))

    expect(mgr.getEntry('nonexistent')).toBeNull()
    mgr.destroy()
  })

  it('calls onReady immediately if already loaded', async () => {
    vi.stubGlobal('fetch', makeMockFetch())
    const mgr = new ImageManager({ url: 'https://example.com/sprite' })

    mgr.load()
    await new Promise(r => setTimeout(r, 50))

    const onReady = vi.fn()
    mgr.load(onReady)
    expect(onReady).toHaveBeenCalledOnce()
    mgr.destroy()
  })

  it('does not start a second fetch if load() is called twice', async () => {
    const mockFetch = makeMockFetch()
    vi.stubGlobal('fetch', mockFetch)
    const mgr = new ImageManager({ url: 'https://example.com/sprite' })

    mgr.load()
    mgr.load()
    await new Promise(r => setTimeout(r, 50))

    // Only 2 fetches (json + png), not 4
    expect(mockFetch).toHaveBeenCalledTimes(2)
    mgr.destroy()
  })
})
```

- [ ] **Step 3: Run tests**

```bash
npx vitest run --config vitest.config.unit.ts src/modular/layers/symbol/image-manager.test.ts
```

Expected: 8 tests pass

- [ ] **Step 4: Type-check**

```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "image-manager"
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/modular/layers/symbol/image-manager.ts src/modular/layers/symbol/image-manager.test.ts
git commit -m "feat(modular/symbol): add ImageManager — sprite loading and atlas resource provider"
```

---

## Task 5: SymbolWorkerIcon

**Goal:** Comlink-exposed worker class. Fetches tile PBF, parses point features, looks up sprite entries in `SpriteData`, generates icon quads with `StructArray`, caches `IconTileData` per tile key. Receives sprite metadata updates from the main thread.

No unit tests — integration only (requires real PBF + browser globals).

**Files:**
- Create: `src/modular/layers/symbol/workers/symbol-worker-icon.ts`

- [ ] **Step 1: Create `symbol-worker-icon.ts`**

```ts
// src/modular/layers/symbol/workers/symbol-worker-icon.ts
import * as Comlink from 'comlink'
import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import { StructArray } from '../../../core/struct-array.ts'
import { IconVertexLayout } from '../icon-types.ts'
import type { SpriteData, SpriteEntry, IconTileData } from '../icon-types.ts'

// Tile extent used by the MVT spec
const TILE_EXTENT = 8192

/**
 * Compute the centroid of a point/multipoint geometry.
 * For point features, loadGeometry() returns [[Point, ...]].
 * We take the first point of the first ring.
 */
function featureCentroid(geometry: ReturnType<InstanceType<typeof VectorTile>['layers'][string]['feature']>['loadGeometry']>): { x: number; y: number } {
  const rings = geometry
  if (rings.length === 0 || rings[0].length === 0) return { x: 0, y: 0 }
  return { x: rings[0][0].x, y: rings[0][0].y }
}

/**
 * Generate 4 vertices + 6 indices for one icon quad centred on (ax, ay).
 * Corners go: TL, TR, BL, BR — two triangles: [0,1,2] and [1,3,2].
 */
function writeQuad(
  verts: StructArray<'ax' | 'ay' | 'ox' | 'oy' | 'u' | 'v'>,
  indices: number[],
  ax: number,
  ay: number,
  entry: SpriteEntry,
  atlasX: number,
  atlasY: number,
): void {
  const hw = entry.width / 2
  const hh = entry.height / 2
  // Offsets stored as value * 32 (sub-pixel precision, matches MapLibre convention)
  const oxL = Math.round(-hw * 32)
  const oxR = Math.round( hw * 32)
  const oyT = Math.round(-hh * 32)
  const oyB = Math.round( hh * 32)

  const u0 = atlasX
  const v0 = atlasY
  const u1 = atlasX + entry.width
  const v1 = atlasY + entry.height

  const base = verts.length
  // TL
  verts.emplaceBack(ax, ay, oxL, oyT, u0, v0)
  // TR
  verts.emplaceBack(ax, ay, oxR, oyT, u1, v0)
  // BL
  verts.emplaceBack(ax, ay, oxL, oyB, u0, v1)
  // BR
  verts.emplaceBack(ax, ay, oxR, oyB, u1, v1)

  // Two triangles: TL-TR-BL, TR-BR-BL
  indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2)
}

export class SymbolWorkerIcon {
  private _spriteData: SpriteData = {}
  /** Atlas entry positions pushed from main thread alongside spriteData */
  private _atlasEntries: { [name: string]: { atlasX: number; atlasY: number } } = {}
  private _cache = new globalThis.Map<string, IconTileData>()
  private _pending = new globalThis.Map<string, AbortController>()

  /**
   * Called by main thread after ImageManager loads.
   * spriteData = sprite.json metadata, atlasEntries = packed atlas positions.
   */
  updateImages(
    spriteData: SpriteData,
    atlasEntries: { [name: string]: { atlasX: number; atlasY: number } },
  ): void {
    this._spriteData = spriteData
    this._atlasEntries = atlasEntries
  }

  /**
   * Fetch a tile PBF and generate icon quads for features whose [iconField]
   * property resolves to a known sprite name.
   */
  async request(
    key: string,
    url: string,
    sourceLayer: string,
    iconField: string,
  ): Promise<IconTileData | null> {
    const controller = new AbortController()
    this._pending.set(key, controller)

    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const buf = await res.arrayBuffer()

      if (!this._pending.has(key)) return null
      this._pending.delete(key)

      const tile = new VectorTile(new Pbf(buf))
      const layer = tile.layers[sourceLayer]
      if (!layer || layer.length === 0) {
        const empty: IconTileData = { vertices: new ArrayBuffer(0), indices: new ArrayBuffer(0), count: 0 }
        this._cache.set(key, empty)
        return empty
      }

      const verts = new StructArray(IconVertexLayout)
      const idxList: number[] = []

      for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i)
        // Only process point features (type 1)
        if (feat.type !== 1) continue

        const spriteName = String(feat.properties[iconField] ?? '')
        const spriteEntry = this._spriteData[spriteName]
        const atlasEntry = this._atlasEntries[spriteName]
        if (!spriteEntry || !atlasEntry) continue

        const { x: ax, y: ay } = featureCentroid(feat.loadGeometry())
        writeQuad(verts, idxList, ax, ay, spriteEntry, atlasEntry.atlasX, atlasEntry.atlasY)
      }

      const idxBuf = new Uint16Array(idxList).buffer
      const result: IconTileData = {
        vertices: verts.arrayBuffer,
        indices: idxBuf,
        count: idxList.length,
      }
      this._cache.set(key, result)
      return result
    } catch {
      this._pending.delete(key)
      return null
    }
  }

  /** Return a cached bucket without re-fetching. Used by main thread side-channel. */
  getBucket(key: string): IconTileData | null {
    return this._cache.get(key) ?? null
  }

  cancel(key: string): void {
    this._pending.get(key)?.abort()
    this._pending.delete(key)
  }
}

Comlink.expose(new SymbolWorkerIcon())
```

Note: The `featureCentroid` function above has a TypeScript annotation shortcut. The actual return type of `feat.loadGeometry()` from `@mapbox/vector-tile` is `Point[][]`. Simplify to avoid the complex inference:

```ts
// Replace the featureCentroid signature with:
function featureCentroid(geometry: { x: number; y: number }[][]): { x: number; y: number } {
  if (geometry.length === 0 || geometry[0].length === 0) return { x: 0, y: 0 }
  return { x: geometry[0][0].x, y: geometry[0][0].y }
}
```

- [ ] **Step 2: Type-check**

```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "symbol-worker-icon"
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/modular/layers/symbol/workers/symbol-worker-icon.ts
git commit -m "feat(modular/symbol): add SymbolWorkerIcon — Comlink worker for icon quad generation"
```

---

## Task 6: IconWorkerService

**Goal:** Comlink wrapper around `SymbolWorkerIcon`. Lives on the main thread. Spawns the worker, wraps it with `Comlink.wrap`, exposes `request`, `cancel`, `getBucket`, `updateImages`, and `destroy`.

No unit tests — browser only.

**Files:**
- Create: `src/modular/layers/symbol/workers/icon-worker-service.ts`

- [ ] **Step 1: Create `icon-worker-service.ts`**

```ts
// src/modular/layers/symbol/workers/icon-worker-service.ts
import * as Comlink from 'comlink'
import type { Remote } from 'comlink'
import type { IconTileData, SpriteData } from '../icon-types.ts'

type SymbolWorkerIconType = import('./symbol-worker-icon.ts').SymbolWorkerIcon

export class IconWorkerService {
  private _worker: Worker
  private _proxy: Remote<SymbolWorkerIconType>

  constructor() {
    this._worker = new Worker(
      new URL('./symbol-worker-icon.ts', import.meta.url),
      { type: 'module' },
    )
    this._proxy = Comlink.wrap<SymbolWorkerIconType>(this._worker)
  }

  /**
   * Push sprite metadata to the worker. Call this once ImageManager has loaded.
   * atlasEntries come from AtlasResult.entries (subset of the fields the worker needs).
   */
  async updateImages(
    spriteData: SpriteData,
    atlasEntries: { [name: string]: { atlasX: number; atlasY: number } },
  ): Promise<void> {
    await this._proxy.updateImages(spriteData, atlasEntries)
  }

  async request(
    key: string,
    url: string,
    sourceLayer: string,
    iconField: string,
  ): Promise<IconTileData | null> {
    return this._proxy.request(key, url, sourceLayer, iconField)
  }

  cancel(key: string): void {
    void this._proxy.cancel(key)
  }

  async getBucket(key: string): Promise<IconTileData | null> {
    return this._proxy.getBucket(key)
  }

  destroy(): void {
    this._proxy[Comlink.releaseProxy]()
    this._worker.terminate()
  }
}
```

- [ ] **Step 2: Type-check**

```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "icon-worker-service"
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/modular/layers/symbol/workers/icon-worker-service.ts
git commit -m "feat(modular/symbol): add IconWorkerService — Comlink wrapper for icon worker"
```

---

## Task 7: IconLayer

**Goal:** Main-thread layer. Creates and owns both `ImageManager` and `IconWorkerService`. Exposes `workerService` so the caller can register it as a `tileService` on the source. On `onAdd` starts loading the sprite and wires the `updateImages` side-channel. On `draw`, retrieves the bucket from the worker cache, uploads vertex/index buffers on first use, and renders with the icon shader. Handles `evictTile` cleanup.

No unit tests — browser only.

**Files:**
- Create: `src/modular/layers/symbol/icon-layer.ts`

- [ ] **Step 1: Create `icon-layer.ts`**

```ts
// src/modular/layers/symbol/icon-layer.ts
import type { DrawContext } from '../../core/render-extension.ts'
import type { RendererAPI } from '../../core/renderer-api.ts'
import type { ProgramDefinition } from '../../core/types.ts'
import type { TileID } from '../../core/types.ts'
import { ImageManager } from './image-manager.ts'
import { IconWorkerService } from './workers/icon-worker-service.ts'
import type { IconTileData } from './icon-types.ts'

// --- Shaders ---

const iconVert = `
attribute vec2 a_anchor;
attribute vec2 a_offset;
attribute vec2 a_tex;

uniform vec2 u_texsize;
uniform vec2 u_resolution;

varying vec2 v_uv;

void main() {
  vec4 proj = projectTile(a_anchor);
  vec2 screen = proj.xy / proj.w;
  screen += (a_offset / 32.0) * 2.0 / u_resolution;
  gl_Position = vec4(screen * proj.w, proj.z, proj.w);
  v_uv = a_tex / u_texsize;
}
`

const iconFrag = `
precision mediump float;

uniform sampler2D u_texture;
uniform float u_opacity;

varying vec2 v_uv;

void main() {
  gl_FragColor = texture2D(u_texture, v_uv) * u_opacity;
}
`

// --- Layer ---

export interface IconLayerOptions {
  /** Source ID used to look up tile URLs from TileManager. */
  source: string
  /** MVT source-layer name inside the PBF. */
  sourceLayer: string
  /** Feature property name whose value is a sprite icon name. */
  iconField: string
  /** ImageManager instance (shared or dedicated). */
  images: ImageManager
  /** Opacity in [0, 1]. Default 1. */
  opacity?: number
}

type TileBuffers = {
  verts: WebGLBuffer
  idx: WebGLBuffer
  count: number
  texture: WebGLTexture
}

export class IconLayer {
  readonly type = 'icon' as const

  static programs: ProgramDefinition[] = [
    { name: 'icon', vertex: iconVert, fragment: iconFrag },
  ]

  readonly source: string
  readonly sourceLayer: string
  readonly iconField: string
  readonly opacity: number
  /**
   * The worker service created and owned by this layer.
   * Pass it to the source registration so the tile manager can use it as a tileService:
   *   map.addSource('my-source', { tileService: iconLayer.workerService })
   */
  readonly workerService: IconWorkerService

  private _images: ImageManager
  private _workerService: IconWorkerService
  private _tileBuffers = new globalThis.Map<string, TileBuffers>()
  private _atlasTexture: WebGLTexture | null = null
  private _atlasWidth = 1
  private _atlasHeight = 1
  private _webgl!: { createGeometryBuffer(key: string, data: ArrayBufferView, target: number): WebGLBuffer }
  private _gl!: WebGLRenderingContext

  constructor(options: IconLayerOptions) {
    this.source = options.source
    this.sourceLayer = options.sourceLayer
    this.iconField = options.iconField
    this._images = options.images
    this.opacity = options.opacity ?? 1
    // IconLayer creates and owns IconWorkerService, just like FillLayer creates VectorTileService
    this._workerService = new IconWorkerService()
    // Expose publicly so caller can: map.addSource('x', { tileService: iconLayer.workerService })
    this.workerService = this._workerService
  }

  onAdd(renderer: RendererAPI): void {
    this._webgl = (renderer as any)._webgl
    this._gl = (renderer as any)._gl

    // Begin loading sprite; push metadata to worker once ready
    this._images.load((spriteData, atlas) => {
      // Build the atlas texture on the GL context
      const gl = this._gl
      const tex = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas.imageData)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      this._atlasTexture = tex
      this._atlasWidth = atlas.atlasWidth
      this._atlasHeight = atlas.atlasHeight

      // Push sprite metadata to worker (stripped to what it needs)
      const atlasEntries: { [name: string]: { atlasX: number; atlasY: number } } = {}
      for (const [name, entry] of Object.entries(atlas.entries)) {
        atlasEntries[name] = { atlasX: entry.atlasX, atlasY: entry.atlasY }
      }
      void this._workerService.updateImages(spriteData, atlasEntries)
    })
  }

  evictTile(key: string): void {
    this._tileBuffers.delete(key)
  }

  draw(ctx: DrawContext): void {
    const { gl, programs, tileID } = ctx
    if (!this._atlasTexture) return

    const program = programs.get('icon')
    if (!program) return

    const key = tileID.key

    if (!this._tileBuffers.has(key)) {
      // Try to fetch from worker cache synchronously (getBucket is a Comlink promise —
      // we store the result once it arrives and skip rendering until then)
      void this._workerService.getBucket(key).then((bucket: IconTileData | null) => {
        if (!bucket || bucket.count === 0) return
        const vertBuf = this._webgl.createGeometryBuffer(
          `tile:${key}:icon:verts`,
          new Int16Array(bucket.vertices),
          gl.ARRAY_BUFFER,
        )
        const idxBuf = this._webgl.createGeometryBuffer(
          `tile:${key}:icon:idx`,
          new Uint16Array(bucket.indices),
          gl.ELEMENT_ARRAY_BUFFER,
        )
        this._tileBuffers.set(key, {
          verts: vertBuf,
          idx: idxBuf,
          count: bucket.count,
          texture: this._atlasTexture!,
        })
      })
      return
    }

    const bufs = this._tileBuffers.get(key)!
    if (bufs.count === 0) return

    gl.useProgram(program)

    // Bind vertex buffer and set attributes
    // Stride = 12 bytes: ax(int16) ay(int16) ox(int16) oy(int16) u(uint16) v(uint16)
    gl.bindBuffer(gl.ARRAY_BUFFER, bufs.verts)

    const aAnchor = gl.getAttribLocation(program, 'a_anchor')
    gl.enableVertexAttribArray(aAnchor)
    gl.vertexAttribPointer(aAnchor, 2, gl.SHORT, false, 12, 0)

    const aOffset = gl.getAttribLocation(program, 'a_offset')
    gl.enableVertexAttribArray(aOffset)
    gl.vertexAttribPointer(aOffset, 2, gl.SHORT, false, 12, 4)

    const aTex = gl.getAttribLocation(program, 'a_tex')
    gl.enableVertexAttribArray(aTex)
    gl.vertexAttribPointer(aTex, 2, gl.UNSIGNED_SHORT, false, 12, 8)

    // Uniforms
    const canvas = gl.canvas as HTMLCanvasElement
    gl.uniform2f(gl.getUniformLocation(program, 'u_resolution'), canvas.width, canvas.height)
    gl.uniform2f(gl.getUniformLocation(program, 'u_texsize'), this._atlasWidth, this._atlasHeight)
    gl.uniform1f(gl.getUniformLocation(program, 'u_opacity'), this.opacity)

    // Bind atlas texture to unit 0
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this._atlasTexture)
    gl.uniform1i(gl.getUniformLocation(program, 'u_texture'), 0)

    // Enable alpha blending for icon transparency
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, bufs.idx)
    gl.drawElements(gl.TRIANGLES, bufs.count, gl.UNSIGNED_SHORT, 0)

    gl.disable(gl.BLEND)
  }
}
```

- [ ] **Step 2: Type-check**

```bash
node_modules/.bin/tsc --noEmit 2>&1 | grep "icon-layer"
```

Expected: no errors (there may be warnings about `_gl`/`_webgl` being private on the renderer — use `// @ts-ignore` on those lines if needed, or cast via `any` as shown)

- [ ] **Step 3: Commit**

```bash
git add src/modular/layers/symbol/icon-layer.ts
git commit -m "feat(modular/symbol): add IconLayer — sprite icon rendering from vector tile features"
```

---

## Task 8: Demo Wiring

**Goal:** Add a working demo page that renders icons from a vector tile source. No automated tests — visual verification only.

**Files:**
- Create: `demo/icon-layer-demo.ts`

- [ ] **Step 1: Create the demo entry**

```ts
// demo/icon-layer-demo.ts
import { createMap } from '../src/modular/core/create_map.ts'
import { ImageManager } from '../src/modular/layers/symbol/image-manager.ts'
import { IconLayer } from '../src/modular/layers/symbol/icon-layer.ts'

const images = new ImageManager({ url: 'https://demotiles.maplibre.org/font/sprite' })

// IconLayer creates and owns IconWorkerService internally.
// Expose workerService so it can be registered as the tile service for the source.
const iconLayer = new IconLayer({
  source: 'openmaptiles',
  sourceLayer: 'poi',
  iconField: 'class',
  images,
  opacity: 0.9,
})

const map = createMap({
  container: document.getElementById('map')!,
  style: {
    version: 8,
    sources: {
      openmaptiles: {
        type: 'vector',
        url: 'https://api.maptiler.com/tiles/v3/tiles.json?key=YOUR_KEY',
        // Wire the layer's worker service as the tile fetcher for this source
        tileService: iconLayer.workerService,
      },
    },
    layers: [],
  },
})

map.addLayer(iconLayer)
```

- [ ] **Step 2: Add demo entry to `demo/index.html` (or existing demo index) if not already present**

Open `demo/index.html` and add a link to `icon-layer-demo.ts` or update the existing demo configuration.

- [ ] **Step 3: Run the dev server and visually verify icons appear on the map**

```bash
npm run dev
```

Open `http://localhost:5173/demo/icon-layer-demo.html` in a browser. Expected: icons visible on POI features.

- [ ] **Step 4: Commit**

```bash
git add demo/icon-layer-demo.ts
git commit -m "feat(demo): add icon-layer demo wiring"
```

---

## Summary

| Task | Files | Tests | Status |
|---|---|---|---|
| 1. Types + IconVertexLayout | `icon-types.ts`, `icon-types.test.ts` | Unit (stride = 12) | - [ ] |
| 2. SpriteLoader | `sprite-loader.ts`, `sprite-loader.test.ts` | Unit (mock fetch) | - [ ] |
| 3. ImageAtlas | `image-atlas.ts`, `image-atlas.test.ts` | Unit (potpack, pixel copy) | - [ ] |
| 4. ImageManager | `image-manager.ts`, `image-manager.test.ts` | Unit (mock fetch) | - [ ] |
| 5. SymbolWorkerIcon | `workers/symbol-worker-icon.ts` | Integration only | - [ ] |
| 6. IconWorkerService | `workers/icon-worker-service.ts` | None (browser) | - [ ] |
| 7. IconLayer | `icon-layer.ts` | None (browser) | - [ ] |
| 8. Demo | `demo/icon-layer-demo.ts` | Visual only | - [ ] |
