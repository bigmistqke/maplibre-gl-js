import Pbf from 'pbf'
import type { StyleGlyph, GlyphMap } from './types.ts'

// ---- Inline minimal PBF parser (avoids importing AlphaImage from src/util/image.ts) ----
// Mirrors src/style/parse_glyph_pbf.ts but produces our local StyleGlyph type.

const BORDER = 3  // matches GLYPH_PBF_BORDER in MapLibre

function readFontstacks(tag: number, glyphs: StyleGlyph[], pbf: any) {
  if (tag === 1) pbf.readMessage(readFontstack, glyphs)
}

function readFontstack(tag: number, glyphs: StyleGlyph[], pbf: any) {
  if (tag === 3) {
    const raw: any = {}
    pbf.readMessage(readGlyph, raw)
    const { id, bitmap, width = 0, height = 0, left = 0, top = 0, advance = 0 } = raw
    // The PBF bitmap already includes the 3px SDF border on each side,
    // so its actual dimensions are (width + 2*BORDER) × (height + 2*BORDER).
    const w = width + 2 * BORDER
    const h = height + 2 * BORDER
    const data = (bitmap && bitmap.length === w * h) ? bitmap : new Uint8Array(w * h)
    glyphs.push({ id, bitmap: { width: w, height: h, data }, metrics: { width, height, left, top, advance } })
  }
}

function readGlyph(tag: number, glyph: any, pbf: any) {
  if      (tag === 1) glyph.id     = pbf.readVarint()
  else if (tag === 2) glyph.bitmap = pbf.readBytes()
  else if (tag === 3) glyph.width  = pbf.readVarint()
  else if (tag === 4) glyph.height = pbf.readVarint()
  else if (tag === 5) glyph.left   = pbf.readSVarint()
  else if (tag === 6) glyph.top    = pbf.readSVarint()
  else if (tag === 7) glyph.advance = pbf.readVarint()
}

function parseGlyphPbfLocal(data: ArrayBuffer | Uint8Array): StyleGlyph[] {
  return new Pbf(data).readFields(readFontstacks, [])
}

// ---- Public API ----

/**
 * Fetch and decode one glyph range (256 codepoints) for a given fontstack.
 *
 * @param fontstack  e.g. "Open Sans Regular"
 * @param range      block start: 0, 256, 512 … (= Math.floor(codepoint / 256) * 256)
 * @param urlTemplate  e.g. "https://…/{fontstack}/{range}.pbf"
 * @param signal     optional AbortSignal
 */
export async function loadGlyphRange(
  fontstack: string,
  range: number,
  urlTemplate: string,
  signal?: AbortSignal,
): Promise<{ [id: number]: StyleGlyph | null }> {
  const url = urlTemplate
    .replace('{fontstack}', encodeURIComponent(fontstack))
    .replace('{range}', `${range}-${range + 255}`)

  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`loadGlyphRange: HTTP ${res.status} for ${url}`)
  const buf = await res.arrayBuffer()
  const glyphs = parseGlyphPbfLocal(buf)

  const result: { [id: number]: StyleGlyph | null } = {}
  // Pre-fill entire range with null so callers know a range is loaded
  for (let i = range; i < range + 256; i++) result[i] = null
  for (const g of glyphs) result[g.id] = g
  return result
}

/** Return the range block start for a given codepoint (0, 256, 512, …). */
export function glyphRange(codepoint: number): number {
  return Math.floor(codepoint / 256) * 256
}
