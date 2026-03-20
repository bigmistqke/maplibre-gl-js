// src/modular/layers/symbol/workers/symbol-worker-icon.ts
import * as Comlink from 'comlink'
import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import { StructArray } from '../../../core/struct-array'
import { IconVertexLayout } from '../icon-types'
import type { SpriteData, SpriteEntry, IconTileData } from '../icon-types'

// Tile extent used by the MVT spec
const TILE_EXTENT = 8192

/**
 * Compute the centroid of a point/multipoint geometry.
 * For point features, loadGeometry() returns an array of rings, where each ring is an array of points.
 * We take the first point of the first ring.
 */
function featureCentroid(geometry: { x: number; y: number }[][]): { x: number; y: number } {
  if (geometry.length === 0 || geometry[0].length === 0) return { x: 0, y: 0 }
  return { x: geometry[0][0].x, y: geometry[0][0].y }
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
  const oxR = Math.round(hw * 32)
  const oyT = Math.round(-hh * 32)
  const oyB = Math.round(hh * 32)

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
