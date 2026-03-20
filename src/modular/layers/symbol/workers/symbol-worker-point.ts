// src/modular/layers/symbol/workers/symbol-worker-point.ts
import * as Comlink from 'comlink'
import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import { shapeAndBuildQuads, getNeededGlyphs } from '../simple-shaper.ts'
import { glyphRange } from '../glyph-loader.ts'
import type { GlyphMap, SymbolTileData, GlyphPositions } from '../types.ts'

interface PendingTile {
  resolve: (data: SymbolTileData | null) => void
  reject: (err: Error) => void
  pbfBuffer: ArrayBuffer
  textField: string
  sourceLayer: string
  fontstack: string
  fontSize: number
  neededRanges: { [stack: string]: Set<number> }
}

export class SymbolWorkerPoint {
  private _glyphMap: GlyphMap = {}
  private _glyphPositions: GlyphPositions = {}
  private _pending = new globalThis.Map<string, AbortController>()
  private _waiting = new globalThis.Map<string, PendingTile>()
  private _buckets = new globalThis.Map<string, SymbolTileData>()

  /**
   * Merge new glyphs into the local map and unblock any waiting tiles
   * whose missing ranges are now satisfied.
   */
  updateGlyphs(partialMap: GlyphMap, positions: GlyphPositions): void {
    for (const stack in partialMap) {
      if (!this._glyphMap[stack]) this._glyphMap[stack] = {}
      Object.assign(this._glyphMap[stack], partialMap[stack])
    }
    for (const stack in positions) {
      if (!this._glyphPositions[stack]) this._glyphPositions[stack] = {}
      Object.assign(this._glyphPositions[stack], positions[stack])
    }
    // Check waiting tiles
    for (const [key, pending] of this._waiting) {
      if (this._allRangesLoaded(pending.neededRanges)) {
        this._waiting.delete(key)
        this._runLayout(key, pending).then(pending.resolve, pending.reject)
      }
    }
  }

  private _allRangesLoaded(neededRanges: { [stack: string]: Set<number> }): boolean {
    for (const stack in neededRanges) {
      const stackGlyphs = this._glyphMap[stack]
      if (!stackGlyphs) return false
      for (const range of neededRanges[stack]) {
        // A range is loaded if any codepoint in that range exists in the map
        // (loadGlyphRange pre-fills the entire range with null)
        if (stackGlyphs[range] === undefined) return false
      }
    }
    return true
  }

  private async _runLayout(key: string, pending: PendingTile): Promise<SymbolTileData | null> {
    const { pbfBuffer, textField, sourceLayer, fontstack, fontSize } = pending

    const tile = new VectorTile(new Pbf(pbfBuffer))
    const allLabels: { text: string; x: number; y: number }[] = []

    const layerNames = sourceLayer ? [sourceLayer] : Object.keys(tile.layers)
    for (const layerName of layerNames) {
      const layer = tile.layers[layerName]
      if (!layer) continue
      for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i)
        const rawText = this._resolveTextField(textField, feat.properties)
        if (!rawText) continue

        // Use centroid of first geometry point as anchor
        const geom = feat.loadGeometry()
        if (!geom || geom.length === 0 || geom[0].length === 0) continue
        allLabels.push({ text: rawText, x: geom[0][0].x, y: geom[0][0].y })
      }
    }
    if (allLabels.length === 0) {
      const empty: SymbolTileData = { vertices: new ArrayBuffer(0), indices: new ArrayBuffer(0), count: 0, labelPositions: [] }
      this._buckets.set(key, empty)
      return empty
    }

    const allVerts: number[] = []
    const allIdx: number[] = []
    const labelPositions: { x: number; y: number }[] = []

    for (const label of allLabels) {
      const result = shapeAndBuildQuads({
        text: label.text,
        anchor: { x: label.x, y: label.y },
        glyphMap: this._glyphMap,
        glyphPositions: this._glyphPositions,
        fontstack,
        fontSize,
      })
      if (!result || result.indices.length === 0) continue

      const idxOffset = allVerts.length / 6  // each vertex is 6 int16s → 12 bytes / 2 = 6
      const buf = result.vertices.arrayBuffer
      const view = new Int16Array(buf)
      for (let i = 0; i < view.length; i++) allVerts.push(view[i])
      for (const idx of result.indices) allIdx.push(idx + idxOffset)
      labelPositions.push({ x: label.x, y: label.y })
    }

    if (allIdx.length === 0) {
      const empty: SymbolTileData = { vertices: new ArrayBuffer(0), indices: new ArrayBuffer(0), count: 0, labelPositions: [] }
      this._buckets.set(key, empty)
      return empty
    }

    const data: SymbolTileData = {
      vertices: new Int16Array(allVerts).buffer,
      indices: new Uint16Array(allIdx).buffer,
      count: allIdx.length,
      labelPositions,
    }
    this._buckets.set(key, data)
    return data
  }

  private _resolveTextField(template: string, props: Record<string, any>): string | null {
    const text = template.replace(/\{([^}]+)\}/g, (_, key) => String(props[key] ?? '')).trim()
    return text.length > 0 ? text : null
  }

  /** Called from main thread when the PBF is already available (via tileData from draw context). */
  requestFromPbf(
    key: string,
    pbfBuffer: ArrayBuffer,
    textField: string,
    sourceLayer: string,
    fontstack: string,
    fontSize: number,
  ): void {
    if (this._buckets.has(key) || this._waiting.has(key)) {
      return  // already processed
    }

    const tile = new VectorTile(new Pbf(pbfBuffer.slice(0)))
    const neededRanges: { [stack: string]: Set<number> } = { [fontstack]: new Set() }

    const layerNames = sourceLayer ? [sourceLayer] : Object.keys(tile.layers)
    for (const layerName of layerNames) {
      const layer = tile.layers[layerName]
      if (!layer) continue
      for (let i = 0; i < layer.length; i++) {
        const feat = layer.feature(i)
        const rawText = this._resolveTextField(textField, feat.properties)
        if (!rawText) continue
        const needed = getNeededGlyphs(rawText, fontstack)
        for (const id of needed[fontstack] ?? []) {
          neededRanges[fontstack].add(glyphRange(id))
        }
      }
    }

    const pending: PendingTile = {
      resolve: () => {},
      reject: () => {},
      pbfBuffer,
      textField,
      sourceLayer,
      fontstack,
      fontSize,
      neededRanges,
    }

    if (this._allRangesLoaded(neededRanges)) {
      void this._runLayout(key, pending)
    } else {
      this._waiting.set(key, pending)
    }
  }

  async request(
    key: string,
    url: string,
    textField: string,
    sourceLayer: string,
    fontstack: string,
    fontSize: number,
  ): Promise<SymbolTileData | null> {
    const controller = new AbortController()
    this._pending.set(key, controller)

    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const pbfBuffer = await res.arrayBuffer()
      if (!this._pending.has(key)) return null  // cancelled
      this._pending.delete(key)

      // Parse tile to find needed glyph ranges
      const tile = new VectorTile(new Pbf(pbfBuffer.slice(0)))
      const neededRanges: { [stack: string]: Set<number> } = { [fontstack]: new Set() }

      const layerNames = sourceLayer ? [sourceLayer] : Object.keys(tile.layers)
      for (const layerName of layerNames) {
        const layer = tile.layers[layerName]
        if (!layer) continue
        for (let i = 0; i < layer.length; i++) {
          const feat = layer.feature(i)
          const rawText = this._resolveTextField(textField, feat.properties)
          if (!rawText) continue
          const needed = getNeededGlyphs(rawText, fontstack)
          for (const id of needed[fontstack] ?? []) {
            neededRanges[fontstack].add(glyphRange(id))
          }
        }
      }

      const pending: PendingTile = {
        resolve: () => {},
        reject: () => {},
        pbfBuffer,
        textField,
        sourceLayer,
        fontstack,
        fontSize,
        neededRanges,
      }

      if (this._allRangesLoaded(neededRanges)) {
        return this._runLayout(key, pending)
      }

      // Queue until glyphs arrive
      return new Promise<SymbolTileData | null>((resolve, reject) => {
        pending.resolve = resolve
        pending.reject = reject
        this._waiting.set(key, pending)
      })
    } catch {
      this._pending.delete(key)
      return null
    }
  }

  getBucket(key: string): SymbolTileData | null {
    return this._buckets.get(key) ?? null
  }

  cancel(key: string): void {
    this._pending.get(key)?.abort()
    this._pending.delete(key)
    this._waiting.delete(key)
  }

  destroy(): void {
    for (const c of this._pending.values()) c.abort()
    this._pending.clear()
    this._waiting.clear()
    this._buckets.clear()
  }
}

Comlink.expose(new SymbolWorkerPoint())
