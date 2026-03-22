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
import { StructArray, createStructArray } from '../../../core/struct-array.ts'
import { GlyphVertexLayout } from '../types.ts'
import ONE_EM from '../../../../symbol/one_em.ts'
import { TILE_SIZE } from '../../../core/constants.ts'
import {
  PlacedSymbolLayout,
  GlyphOffsetLayout,
  SymbolLineVertexLayout,
  SymbolInstanceLayout,
  CollisionBoxLayout,
} from '../vendor/symbol_structs.ts'
import { WritingMode } from '../../../../symbol/shaping.ts'
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

    // StructArrays for vendored projection code
    const placedSymbolArray = createStructArray(PlacedSymbolLayout)
    const glyphOffsetArray = createStructArray(GlyphOffsetLayout)
    const lineVertexArray = createStructArray(SymbolLineVertexLayout)
    const symbolInstanceArray = createStructArray(SymbolInstanceLayout)
    const collisionBoxArray = createStructArray(CollisionBoxLayout)
    const SIZE_PACK_FACTOR = 128

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

    // Track anchor positions per text to prevent same-text labels too close together.
    // Vendored from MapLibre's anchorIsTooClose (symbol_layout.ts:733-749).
    const compareText: Record<string, Array<{ x: number; y: number }>> = {}
    const textPixelRatio = TILE_EXTENT / TILE_SIZE
    const symbolMinDistance = textPixelRatio * 250 // default symbol-spacing
    const textRepeatDistance = symbolMinDistance / 2

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

          const labelWidth = (shaping.right - shaping.left) * (fontSize / ONE_EM) * textPixelRatio
          const symbolSpacing = Math.max(labelWidth * 2, symbolMinDistance)

          const anchors = getLineAnchors({
            line,
            symbolMinDistance: symbolSpacing,
            textMaxAngle: Math.PI / 4,
            shaping,
            fontSize,
            extent: TILE_EXTENT,
          })

          for (const anchor of anchors) {
            // Skip if same text was placed too close (MapLibre's anchorIsTooClose)
            if (anchorIsTooClose(compareText, rawText, textRepeatDistance, anchor)) continue
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
              // For along-line text, glyphOffset[1] contains the vertical baseline
              // offset (SHAPING_DEFAULT_OFFSET = -17) that centers text on the line.
              // MapLibre applies this as a perpendicular line offset during projection.
              // We bake it into the quad corners instead, since our projection walk
              // does not implement lineOffsetY.
              const baselineY = quad.glyphOffset[1]
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
                  Math.round((corner.y + baselineY) * scale * 32),
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

            // Store the CLIPPED line as-is (no anchor injection).
            // anchor.segment indexes into this line directly.
            // MapLibre uses the same approach: placeGlyphAlongLine starts
            // at the projected anchor point (not a vertex) and walks the
            // line array from anchorSegment.
            const flatLineVerts = line.flatMap(p => [p.x, p.y])
            lineLabels.push({
              anchorX: anchor.x,
              anchorY: anchor.y,
              segment: anchor.segment,
              glyphOffsets,
              lineVertices: flatLineVerts,
            })

            // -- StructArray population (mirrors bucket_shim.ts) --
            const numGlyphs = glyphOffsets.length
            const numLineVerts = flatLineVerts.length / 2

            // lineVertexArray: one entry per vertex with tileUnitDistanceFromAnchor
            const lineStartForThisLabel = lineVertexArray.length
            for (let li = 0; li < numLineVerts; li++) {
              const lx = flatLineVerts[li * 2]
              const ly = flatLineVerts[li * 2 + 1]
              // tileUnitDistanceFromAnchor: 0 for now (not critical for basic line walking)
              lineVertexArray.emplaceBack(lx, ly, 0)
            }

            // glyphOffsetArray: one entry per glyph
            const glyphStartForThisLabel = glyphOffsetArray.length
            for (let gi = 0; gi < numGlyphs; gi++) {
              glyphOffsetArray.emplaceBack(glyphOffsets[gi])
            }

            // placedSymbolArray: one entry per label
            const packedSize = Math.round(fontSize * SIZE_PACK_FACTOR)
            placedSymbolArray.emplaceBack(
              anchor.x,                        // anchorX
              anchor.y,                        // anchorY
              glyphStartForThisLabel,          // glyphStartIndex
              numGlyphs,                       // numGlyphs
              glyphStartForThisLabel * 4,      // vertexStartIndex (4 verts per glyph)
              lineStartForThisLabel,           // lineStartIndex
              numLineVerts,                    // lineLength
              anchor.segment,                  // segment
              packedSize,                      // lowerSize
              packedSize,                      // upperSize
              0,                               // lineOffsetX
              0,                               // lineOffsetY
              WritingMode.horizontal,          // writingMode
              0,                               // placedOrientation
              0,                               // hidden
              0,                               // crossTileID
              -1,                              // associatedIconIndex
            )

            // collisionBoxArray: one box per label
            const textPixelRatioForBox = TILE_EXTENT / TILE_SIZE
            const halfW = Math.round((shaping.right - shaping.left) * (fontSize / ONE_EM) * textPixelRatioForBox / 2)
            const halfH = Math.round((shaping.top - shaping.bottom) * (fontSize / ONE_EM) * textPixelRatioForBox / 2)
            const collisionBoxStart = collisionBoxArray.length
            collisionBoxArray.emplaceBack(
              anchor.x,        // anchorPointX
              anchor.y,        // anchorPointY
              -halfW,          // x1
              -halfH,          // y1
              halfW,           // x2
              halfH,           // y2
              0,               // featureIndex
              0,               // sourceLayerIndex
              0,               // bucketIndex
            )

            // symbolInstanceArray: one entry per label
            const placedSymbolIdx = placedSymbolArray.length - 1
            symbolInstanceArray.emplaceBack(
              anchor.x,         // anchorX
              anchor.y,         // anchorY
              placedSymbolIdx,  // rightJustifiedTextSymbolIndex
              placedSymbolIdx,  // centerJustifiedTextSymbolIndex
              placedSymbolIdx,  // leftJustifiedTextSymbolIndex
              -1,               // verticalPlacedTextSymbolIndex
              -1,               // placedIconSymbolIndex
              -1,               // verticalPlacedIconSymbolIndex
              0,                // key
              collisionBoxStart,     // textBoxStartIndex
              collisionBoxStart + 1, // textBoxEndIndex
              0,                // verticalTextBoxStartIndex
              0,                // verticalTextBoxEndIndex
              0,                // iconBoxStartIndex
              0,                // iconBoxEndIndex
              0,                // verticalIconBoxStartIndex
              0,                // verticalIconBoxEndIndex
              0,                // featureIndex
              numGlyphs * 4,   // numHorizontalGlyphVertices
              0,                // numVerticalGlyphVertices
              0,                // numIconVertices
              0,                // numVerticalIconVertices
              0,                // useRuntimeCollisionCircles
              0,                // crossTileID
              0,                // textBoxScale
              0,                // collisionCircleDiameter
              0,                // textAnchorOffsetStartIndex
              0,                // textAnchorOffsetEndIndex
            )
          }
        }
      }
    }

    debug('_runLayout done', { key, quads: allIdx.length / 6, labels: labelPositions.length })

    // Trim StructArrays to exact size and extract transferable buffers
    placedSymbolArray._trim()
    glyphOffsetArray._trim()
    lineVertexArray._trim()
    symbolInstanceArray._trim()
    collisionBoxArray._trim()

    const data: SymbolTileData = {
      vertices: new Int16Array(allVerts).buffer,
      indices: new Uint16Array(allIdx).buffer,
      count: allIdx.length,
      labelPositions,
      labelTexts,
      indicesPerLabel,
      lineLabels,

      // StructArray buffers for vendored projection code
      placedSymbolArrayBuffer: placedSymbolArray.arrayBuffer,
      glyphOffsetArrayBuffer: glyphOffsetArray.arrayBuffer,
      lineVertexArrayBuffer: lineVertexArray.arrayBuffer,
      symbolInstanceArrayBuffer: symbolInstanceArray.arrayBuffer,
      collisionBoxArrayBuffer: collisionBoxArray.arrayBuffer,
      placedSymbolCount: placedSymbolArray.length,
      glyphOffsetCount: glyphOffsetArray.length,
      lineVertexCount: lineVertexArray.length,
      symbolInstanceCount: symbolInstanceArray.length,
      collisionBoxCount: collisionBoxArray.length,
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

/**
 * Vendored from MapLibre's symbol_layout.ts:733-749.
 * Prevents same-text labels from being placed too close together.
 */
function anchorIsTooClose(
  compareText: Record<string, Array<{ x: number; y: number }>>,
  text: string,
  repeatDistance: number,
  anchor: { x: number; y: number },
): boolean {
  if (!(text in compareText)) {
    compareText[text] = []
  } else {
    const otherAnchors = compareText[text]
    for (let k = otherAnchors.length - 1; k >= 0; k--) {
      const dx = anchor.x - otherAnchors[k].x
      const dy = anchor.y - otherAnchors[k].y
      if (Math.sqrt(dx * dx + dy * dy) < repeatDistance) {
        return true
      }
    }
  }
  compareText[text].push(anchor)
  return false
}

Comlink.expose(new SymbolWorkerLine())
