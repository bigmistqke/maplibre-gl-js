// Vendored from maplibre-gl-js
// Source: src/style/style_layer/variable_text_anchor.ts
// Modifications: import paths, type narrowing, STUB comments
// Note: evaluateVariableOffset and getTextVariableAnchorOffset are NOT vendored here —
// they depend on SymbolStyleLayer, SymbolFeature, CanonicalTileID, and ONE_EM from
// MapLibre internals. Only the enum and type used by collision/placement code are kept.

export enum TextAnchorEnum {
    'center' = 1,
    'left' = 2,
    'right' = 3,
    'top' = 4,
    'bottom' = 5,
    'top-left' = 6,
    'top-right' = 7,
    'bottom-left' = 8,
    'bottom-right' = 9
}

export type TextAnchor = keyof typeof TextAnchorEnum;

// The radial offset is to the edge of the text box.
// In the horizontal direction, the edge of the text box is where glyphs start.
// But in the vertical direction, the glyphs appear to "start" at the baseline.
// We don't actually load baseline data, but we assume an offset of ONE_EM - 17
// (see "yOffset" in shaping.js)
export const baselineOffset = 7;
export const INVALID_TEXT_OFFSET = Number.POSITIVE_INFINITY;
