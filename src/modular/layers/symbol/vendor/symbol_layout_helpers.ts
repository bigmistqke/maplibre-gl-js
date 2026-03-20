// src/modular/layers/symbol/vendor/symbol_layout_helpers.ts
//
// Extracted shared internals from src/symbol/symbol_layout.ts.
// Provides stable wrappers for the pieces used by both the point and line workers.
// Does NOT import line-specific machinery (path_interpolator, check_max_angle, clip_line, merge_lines).

import { shapeText, WritingMode } from '../../../../symbol/shaping.ts'
import { getGlyphQuads } from '../../../../symbol/quads.ts'
import { getAnchors, getCenterAnchor } from '../../../../symbol/get_anchors.ts'
import { Anchor } from '../../../../symbol/anchor.ts'
import ONE_EM from '../../../../symbol/one_em.ts'
import { Formatted, FormattedSection } from '@maplibre/maplibre-gl-style-spec'
import Point from '@mapbox/point-geometry'
import type { Shaping, TextJustify } from '../../../../symbol/shaping.ts'
import type { GlyphPositions, GlyphMap } from '../types.ts'

export type { Shaping }

export function getDefaultHorizontalShaping(
  horizontalShapings: Partial<Record<TextJustify, Shaping>>,
): Shaping | false {
  for (const justification in horizontalShapings) {
    return horizontalShapings[justification as TextJustify]!
  }
  return false
}

export interface SimpleShapingOptions {
  text: string
  glyphMap: GlyphMap
  glyphPositions: GlyphPositions
  fontstack: string
  fontSize: number
  lineHeight?: number
  spacing?: number
  textAnchor?: string
  textJustify?: TextJustify
  textOffset?: [number, number]
  alongLine?: boolean
}

export function shapeTextForLayout(options: SimpleShapingOptions): Shaping | false {
  const {
    text,
    glyphMap,
    glyphPositions,
    fontstack,
    fontSize,
    lineHeight = 24,
    spacing = 0,
    textAnchor = 'center',
    textJustify = 'center',
    textOffset = [0, 0],
    alongLine = false,
  } = options

  // Build a Formatted object — single section with the entire text
  const formatted = new Formatted([new FormattedSection(text, null, null, null, null, null)])

  const maxWidth = alongLine ? Infinity : 10 * ONE_EM
  const writingMode = WritingMode.horizontal

  return shapeText(
    formatted,
    glyphMap as any,  // our GlyphMap is structurally compatible at runtime

    glyphPositions,   // atlas positions (rect + metrics) per codepoint
    {},               // imagePositions (none)
    fontstack,
    maxWidth,
    lineHeight,
    textAnchor as any,
    textJustify,
    spacing,
    textOffset,
    writingMode,
    false,            // allowVerticalPlacement
    ONE_EM,           // layoutTextSize — pass ONE_EM so MapLibre's scale factor = 1
    ONE_EM,           // layoutTextSizeThisZoom — our scale = fontSize/ONE_EM is the sole scale
  )
}

export interface GlyphQuadOptions {
  anchor: { x: number; y: number }
  shaping: Shaping
  glyphPositions: GlyphPositions
  fontstack: string
  textOffset?: [number, number]
  alongLine?: boolean
}

export function buildGlyphQuads(options: GlyphQuadOptions) {
  const { anchor, shaping, textOffset = [0, 0], alongLine = false } = options

  const maplibreAnchor = new Anchor(anchor.x, anchor.y, 0, undefined)

  const layer = {
    layout: {
      get: (name: string) => ({
        evaluate: () => {
          if (name === 'text-rotate') return 0
          if (name === 'text-keep-upright') return false
          return null
        }
      })
    }
  }

  return getGlyphQuads(
    maplibreAnchor,
    shaping,
    textOffset,
    layer as any,
    alongLine,
    {} as any,       // feature
    {},              // imageMap
    false,           // allowVerticalPlacement
  )
}

export interface LineAnchorOptions {
  line: Point[]
  symbolMinDistance: number
  textMaxAngle: number
  shaping: Shaping | false
  fontSize: number
  extent?: number
  overscaling?: number
}

export function getLineAnchors(options: LineAnchorOptions): Anchor[] {
  const {
    line,
    symbolMinDistance,
    textMaxAngle,
    shaping,
    fontSize,
    extent = 4096,
    overscaling = 1,
  } = options

  if (!shaping) return []

  const glyphSize = 24
  const fontScale = fontSize / glyphSize
  const textMaxBoxScale = fontScale

  return getAnchors(
    line,
    symbolMinDistance,
    textMaxAngle,
    shaping,
    undefined as any,
    glyphSize,
    textMaxBoxScale,
    overscaling,
    extent,
  )
}

export function getCenterLineAnchor(options: Omit<LineAnchorOptions, 'symbolMinDistance'>): Anchor | null {
  const { line, textMaxAngle, shaping, fontSize } = options

  if (!shaping) return null

  const glyphSize = 24
  const fontScale = fontSize / glyphSize
  const textMaxBoxScale = fontScale

  return getCenterAnchor(
    line,
    textMaxAngle,
    shaping,
    undefined as any,
    glyphSize,
    textMaxBoxScale,
  ) ?? null
}
