// src/modular/layers/symbol/simple-shaper.ts
import { Formatted, FormattedSection } from '@maplibre/maplibre-gl-style-spec'
import ONE_EM from '../../../symbol/one_em.ts'
import { shapeText } from '../../../symbol/shaping.ts'
import { getGlyphQuads } from '../../../symbol/quads.ts'
import { Anchor } from '../../../symbol/anchor.ts'
import { StructArray } from '../../core/struct-array.ts'
import { GlyphVertexLayout } from './types.ts'
import type { GlyphMap, GlyphPositions } from './types.ts'

export interface ShaperOptions {
  text: string
  anchor: { x: number; y: number }
  glyphMap: GlyphMap
  glyphPositions: GlyphPositions
  fontstack: string
  fontSize: number
}

export interface ShaperResult {
  vertices: StructArray<'ax' | 'ay' | 'ox' | 'oy' | 'u' | 'v'>
  indices: number[]
}

/**
 * Shape a text string and generate glyph quads packed into a StructArray.
 * Returns null if shaping fails (e.g. all glyphs missing).
 */
export function shapeAndBuildQuads(options: ShaperOptions): ShaperResult | null {
  const { text, anchor, glyphMap, glyphPositions, fontstack, fontSize } = options

  // Build a Formatted object — one section with the entire text
  const formatted = new Formatted([new FormattedSection(text, null, null, null, null, null)])

  const shaping = shapeText(
    formatted,
    glyphMap,      // StyleGlyph data (id, bitmap, metrics) per codepoint
    glyphPositions, // atlas positions (rect + metrics) per codepoint
    {},        // imagePositions (none)
    fontstack,
    24,        // maxWidth in pixels
    24,        // lineHeight in pixels
    'center',  // textAnchor
    'center',  // textJustify
    0,         // spacing
    [0, 0],    // translate
    1,         // writingMode (horizontal)
    false,     // allowVerticalPlacement
    fontSize,  // layoutTextSize
    fontSize,  // layoutTextSizeThisZoom
  )

  if (!shaping) return null

  const maplibreAnchor = new Anchor(anchor.x, anchor.y, 0, undefined)

  const quads = getGlyphQuads(
    maplibreAnchor,
    shaping,
    [0, 0],    // textOffset
    {
      layout: {
        get: (name: string) => ({
          evaluate: () => {
            if (name === 'text-rotate') return 0
            if (name === 'text-keep-upright') return false
            return null
          }
        })
      }
    } as any,
    false,     // alongLine
    {} as any, // feature
    {},        // imageMap
    false,     // allowVerticalPlacement
  )

  if (!quads || quads.length === 0) return null

  const verts = new StructArray(GlyphVertexLayout)
  const indices: number[] = []
  const scale = fontSize / ONE_EM  // ems → pixels

  for (const quad of quads) {
    const base = verts.length

    // Each quad: 4 corners (tl, tr, bl, br)
    // tl, tr, bl, br are Points with x/y offsets in ems
    const corners = [quad.tl, quad.tr, quad.bl, quad.br]
    const uvCorners = [
      { u: quad.tex.x,             v: quad.tex.y },
      { u: quad.tex.x + quad.tex.w, v: quad.tex.y },
      { u: quad.tex.x,             v: quad.tex.y + quad.tex.h },
      { u: quad.tex.x + quad.tex.w, v: quad.tex.y + quad.tex.h },
    ]

    for (let i = 0; i < 4; i++) {
      const c = corners[i]
      const uv = uvCorners[i]
      // offset stored as int16 ×32 fixed-point (matching shader: a_offset / 32.0 = pixels)
      verts.emplaceBack(
        anchor.x,             // ax (tile coords)
        anchor.y,             // ay (tile coords)
        Math.round(c.x * scale * 32),  // ox (fixed-point pixels ×32)
        Math.round(c.y * scale * 32),  // oy
        Math.round(uv.u),     // u (atlas pixels)
        Math.round(uv.v),     // v (atlas pixels)
      )
    }

    // Two triangles: tl-tr-bl, tr-br-bl
    indices.push(base + 0, base + 1, base + 2, base + 1, base + 3, base + 2)
  }

  return { vertices: verts, indices }
}

/** Extract codepoints needed for a text string from a fontstack's glyph map. */
export function getNeededGlyphs(text: string, fontstack: string): { [stack: string]: number[] } {
  const codepoints = new Set<number>()
  for (let i = 0; i < text.length; i++) {
    const cp = text.codePointAt(i)
    if (cp !== undefined) codepoints.add(cp)
    // Skip surrogate pairs
    if (cp !== undefined && cp > 0xffff) i++
  }
  return { [fontstack]: Array.from(codepoints) }
}
