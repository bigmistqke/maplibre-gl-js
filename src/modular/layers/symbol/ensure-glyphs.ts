import { VectorTile } from '@mapbox/vector-tile'
import Pbf from 'pbf'
import type { GlyphManager } from './glyph-manager.ts'

/**
 * Extract unique codepoints from an array of text strings.
 */
export function extractCodepoints(texts: string[]): number[] {
  const codepoints = new Set<number>()
  for (const text of texts) {
    for (let i = 0; i < text.length; i++) {
      const cp = text.codePointAt(i)
      if (cp !== undefined) {
        codepoints.add(cp)
        if (cp > 0xffff) i++ // skip surrogate pair
      }
    }
  }
  return Array.from(codepoints)
}

/**
 * Scan PBF tile data for text values and trigger glyph range loading.
 * Shared by TextLayer and LineTextLayer.
 */
export function ensureGlyphsForTile(
  pbfBuffer: ArrayBuffer,
  textField: string,
  sourceLayer: string,
  fontstack: string,
  glyphManager: GlyphManager,
): void {
  try {
    const tile = new VectorTile(new Pbf(pbfBuffer.slice(0)))
    const layerNames = sourceLayer ? [sourceLayer] : Object.keys(tile.layers)
    const texts: string[] = []

    for (const layerName of layerNames) {
      const layer = tile.layers[layerName]
      if (!layer) continue
      for (let i = 0; i < layer.length; i++) {
        const raw = textField
          .replace(/\{([^}]+)\}/g, (_, k) => String(layer.feature(i).properties[k] ?? ''))
          .trim()
        if (raw) texts.push(raw)
      }
    }

    const codepoints = extractCodepoints(texts)
    if (codepoints.length > 0) {
      void glyphManager.getGlyphs({ [fontstack]: codepoints })
    }
  } catch { /* ignore parse errors */ }
}
