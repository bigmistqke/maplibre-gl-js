// src/modular/layers/symbol/workers/symbol-worker-line.ts
//
// Line text worker — places labels along road/river polylines.
// This worker imports the full line machinery. It intentionally does NOT share
// a bundle with symbol-worker-point.ts so that tree-shaking can exclude clip_line,
// merge_lines, path_interpolator, check_max_angle from the point worker bundle.
import * as Comlink from 'comlink'
import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import { createDebug } from '../../../debug.ts'
import { clipLine } from '../vendor/clip_line.ts'
import { mergeLines } from '../vendor/merge_lines.ts'
import {
  shapeTextForLayout,
  buildGlyphQuads,
  getLineAnchors,
} from '../vendor/symbol_layout_helpers.ts'
import { glyphRange } from '../glyph-loader.ts'
import { StructArray } from '../../../core/struct-array.ts'
import { GlyphVertexLayout } from '../types.ts'
import ONE_EM from '../../../../symbol/one_em.ts'
import type { GlyphMap, GlyphPositions, SymbolTileData, LineLabelInfo } from '../types.ts'

const debug = createDebug('LineWorker', true)

const TILE_EXTENT = 4096

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

export class SymbolWorkerLine {
  private _glyphMap: GlyphMap = {}
  private _glyphPositions: GlyphPositions = {}
  private _pending = new globalThis.Map<string, AbortController>()
  private _waiting = new globalThis.Map<string, PendingTile>()
  private _buckets = new globalThis.Map<string, SymbolTileData>()

  updateGlyphs(partialMap: GlyphMap, positions: GlyphPositions): void {
    debug('updateGlyphs', { waiting: this._waiting.size })
    for (const stack in partialMap) {
      if (!this._glyphMap[stack]) this._glyphMap[stack] = {}
      Object.assign(this._glyphMap[stack], partialMap[stack])
    }
    for (const stack in positions) {
      if (!this._glyphPositions[stack]) this._glyphPositions[stack] = {}
      Object.assign(this._glyphPositions[stack], positions[stack])
    }
    for (const [key, pending] of this._waiting) {
      if (this._allRangesLoaded(pending.neededRanges)) {
        debug('updateGlyphs: unblocking waiting tile', { key })
        this._waiting.delete(key)
        this._runLayout(key, pending).then(pending.resolve, pending.reject)
      }
    }
  }

  private _allRangesLoaded(neededRanges: { [stack: string]: Set<number> }): boolean {
    for (const stack in neededRanges) {
      if (neededRanges[stack].size === 0) continue  // no glyphs needed for this stack
      const stackGlyphs = this._glyphMap[stack]
      if (!stackGlyphs) return false
      for (const range of neededRanges[stack]) {
        if (stackGlyphs[range] === undefined) return false
      }
    }
    return true
  }

  private async _runLayout(key: string, pending: PendingTile): Promise<SymbolTileData | null> {
    const { pbfBuffer, textField, sourceLayer, fontstack, fontSize } = pending

    const tile = new VectorTile(new Pbf(pbfBuffer))
    const layer = tile.layers[sourceLayer]
    debug('_runLayout', { key, sourceLayer, hasLayer: !!layer, featureCount: layer?.length ?? 0 })
    if (!layer || layer.length === 0) {
      this._buckets.set(key, { vertices: new ArrayBuffer(0), indices: new ArrayBuffer(0), count: 0, labelPositions: [] })
      return null
    }

    const allVerts: number[] = []
    const allIdx: number[] = []
    const labelPositions: { x: number; y: number }[] = []
    const indicesPerLabel: number[] = []
    const labelTexts: string[] = []
    const lineLabels: LineLabelInfo[] = []

    // Collect all line features with resolved text for merging
    const lineFeatures: Array<{ geometry: ReturnType<ReturnType<typeof layer.feature>['loadGeometry']>; text: string }> = []
    for (let i = 0; i < layer.length; i++) {
      const feat = layer.feature(i)
      if (feat.type !== 2) continue
      const rawText = this._resolveTextField(textField, feat.properties)
      if (!rawText) continue
      const geom = feat.loadGeometry()
      if (!geom || geom.length === 0) continue
      lineFeatures.push({ geometry: geom, text: rawText })
    }

    // Merge features with matching text and shared endpoints
    type LocalLineFeature = { geometry: ReturnType<ReturnType<typeof layer.feature>['loadGeometry']>; text: string }
    const mergedFeatures = mergeLines(lineFeatures as unknown as Parameters<typeof mergeLines>[0]) as unknown as Array<LocalLineFeature>

    for (const mergedFeat of mergedFeatures) {
      const geom = mergedFeat.geometry
      if (!geom || geom.length === 0) continue
      const rawText = mergedFeat.text

      const shaping = shapeTextForLayout({
        text: rawText,
        glyphMap: this._glyphMap,
        glyphPositions: this._glyphPositions,
        fontstack,
        fontSize,
        alongLine: true,
      })
      if (!shaping) continue

      for (const ring of geom) {
        if (ring.length < 2) continue

        const clipped = clipLine([ring], 0, 0, TILE_EXTENT, TILE_EXTENT)

        for (const line of clipped) {
          if (line.length < 2) continue

          // Compute label width in tile units so labels don't overlap.
          // textPixelRatio converts CSS px → tile units at this zoom.
          const textPixelRatio = TILE_EXTENT / 512
          const labelWidth = (shaping.right - shaping.left) * (fontSize / ONE_EM) * textPixelRatio
          const symbolSpacing = Math.max(labelWidth * 2, 250 * textPixelRatio)

          const anchors = getLineAnchors({
            line,
            symbolMinDistance: symbolSpacing,
            textMaxAngle: Math.PI / 4,
            shaping,
            fontSize,
            extent: TILE_EXTENT,
          })

          for (const anchor of anchors) {
            const quads = buildGlyphQuads({
              anchor: { x: anchor.x, y: anchor.y },
              shaping,
              glyphPositions: this._glyphPositions,
              fontstack,
              textOffset: [0, 0],
              alongLine: true,
            })

            if (!quads || quads.length === 0) continue

            const scale = fontSize / ONE_EM

            // Extract per-glyph center offsets along the line in ONE_EM units (raw).
            // MapLibre stores these unscaled in glyphOffsetArray and applies
            // fontScale (= fontSize / 24) at placement time in projection.ts:439.
            const glyphOffsets: number[] = []
            for (const posLine of shaping.positionedLines) {
              for (const pg of posLine.positionedGlyphs) {
                const halfAdvance = pg.metrics.advance * pg.scale / 2
                glyphOffsets.push(pg.x + halfAdvance)
              }
            }
            const verts = new StructArray(GlyphVertexLayout)

            for (let qi = 0; qi < quads.length; qi++) {
              const quad = quads[qi]
              const corners = [quad.tl, quad.tr, quad.bl, quad.br]
              const uvCorners = [
                { u: quad.tex.x,              v: quad.tex.y },
                { u: quad.tex.x + quad.tex.w, v: quad.tex.y },
                { u: quad.tex.x,              v: quad.tex.y + quad.tex.h },
                { u: quad.tex.x + quad.tex.w, v: quad.tex.y + quad.tex.h },
              ]
              for (let c = 0; c < 4; c++) {
                const corner = corners[c]
                const uv = uvCorners[c]
                verts.emplaceBack(
                  anchor.x,
                  anchor.y,
                  Math.round(corner.x * scale * 32),
                  Math.round(corner.y * scale * 32),
                  Math.round(uv.u),
                  Math.round(uv.v),
                )
              }
            }

            const idxOffset = allVerts.length / 6
            const view = new Int16Array(verts.arrayBuffer)
            for (let vi = 0; vi < view.length; vi++) allVerts.push(view[vi])

            const quadCount = quads.length
            for (let q = 0; q < quadCount; q++) {
              const base = idxOffset + q * 4
              allIdx.push(base + 0, base + 1, base + 2, base + 1, base + 3, base + 2)
            }

            labelPositions.push({ x: anchor.x, y: anchor.y })
            labelTexts.push(rawText)
            indicesPerLabel.push(quadCount * 6)

            // Store the CLIPPED line (the one getLineAnchors placed this anchor on).
            // anchor.segment is correct for this line — no remapping needed.
            // This matches MapLibre's approach: symbol_bucket.ts:600 stores the
            // clipped line with addToLineVertexArray.
            //
            // Inject the anchor into the line at segment+1 so the main thread
            // can start walking from the anchor position directly.
            // MapLibre does this implicitly via the cached anchorPoint in
            // projection.ts:817-821.
            const lineWithAnchor: number[] = []
            for (let li = 0; li <= anchor.segment; li++) {
              lineWithAnchor.push(line[li].x, line[li].y)
            }
            // Inject anchor point
            lineWithAnchor.push(anchor.x, anchor.y)
            for (let li = anchor.segment + 1; li < line.length; li++) {
              lineWithAnchor.push(line[li].x, line[li].y)
            }

            lineLabels.push({
              anchorX: anchor.x,
              anchorY: anchor.y,
              // After injection, anchor is at index (anchor.segment + 1)
              segment: anchor.segment + 1,
              glyphOffsets,
              lineVertices: lineWithAnchor,
            })
          }
        }
      }
    }

    debug('_runLayout done', { key, quads: allIdx.length / 6, labels: labelPositions.length })

    const data: SymbolTileData = {
      vertices: new Int16Array(allVerts).buffer,
      indices: new Uint16Array(allIdx).buffer,
      count: allIdx.length,
      labelPositions,
      labelTexts,
      indicesPerLabel,
      lineLabels,
    }
    this._buckets.set(key, data)
    return allIdx.length === 0 ? null : data
  }

  private _resolveTextField(template: string, props: Record<string, any>): string | null {
    const text = template.replace(/\{([^}]+)\}/g, (_, k) => String(props[k] ?? '')).trim()
    return text.length > 0 ? text : null
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
      if (!this._pending.has(key)) return null
      this._pending.delete(key)

      const tile = new VectorTile(new Pbf(pbfBuffer.slice(0)))
      const neededRanges: { [stack: string]: Set<number> } = { [fontstack]: new Set() }

      const vLayer = tile.layers[sourceLayer]
      if (vLayer) {
        for (let i = 0; i < vLayer.length; i++) {
          const feat = vLayer.feature(i)
          if (feat.type !== 2) continue
          const rawText = this._resolveTextField(textField, feat.properties)
          if (!rawText) continue
          for (let ci = 0; ci < rawText.length; ci++) {
            const cp = rawText.codePointAt(ci)
            if (cp !== undefined) {
              neededRanges[fontstack].add(glyphRange(cp))
              if (cp > 0xffff) ci++
            }
          }
        }
      }

      const pendingTile: PendingTile = {
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
        return this._runLayout(key, pendingTile)
      }

      return new Promise<SymbolTileData | null>((resolve, reject) => {
        pendingTile.resolve = resolve
        pendingTile.reject = reject
        this._waiting.set(key, pendingTile)
      })
    } catch {
      this._pending.delete(key)
      return null
    }
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
      debug('requestFromPbf: already processed', { key })
      return  // already processed
    }
    debug('requestFromPbf', { key, sourceLayer })

    const tile = new VectorTile(new Pbf(pbfBuffer.slice(0)))
    const neededRanges: { [stack: string]: Set<number> } = { [fontstack]: new Set() }

    const vLayer = tile.layers[sourceLayer]
    if (vLayer) {
      for (let i = 0; i < vLayer.length; i++) {
        const feat = vLayer.feature(i)
        if (feat.type !== 2) continue
        const rawText = this._resolveTextField(textField, feat.properties)
        if (!rawText) continue
        for (let ci = 0; ci < rawText.length; ci++) {
          const cp = rawText.codePointAt(ci)
          if (cp !== undefined) {
            neededRanges[fontstack].add(glyphRange(cp))
            if (cp > 0xffff) ci++
          }
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
      debug('requestFromPbf: glyphs ready, running layout', { key })
      void this._runLayout(key, pending)
    } else {
      debug('requestFromPbf: waiting for glyphs', { key, ranges: [...neededRanges[fontstack]] })
      this._waiting.set(key, pending)
    }
  }

  getBucket(key: string): SymbolTileData | null {
    return this._buckets.get(key) ?? null
  }

  clearAllBuckets(): void {
    this._waiting.clear()
    this._buckets.clear()
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

Comlink.expose(new SymbolWorkerLine())
