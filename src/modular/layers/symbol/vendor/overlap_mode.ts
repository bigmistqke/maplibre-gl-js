// Vendored from maplibre-gl-js
// Source: src/style/style_layer/overlap_mode.ts
// Modifications: import paths, type narrowing, STUB comments

/**
 * The overlap mode for properties like `icon-overlap` and `text-overlap`
 */
export type OverlapMode = 'never' | 'always' | 'cooperative';

/**
 * Derive the effective overlap mode from a layout object.
 *
 * STUB: The full signature takes a PossiblyEvaluated<SymbolLayoutProps> and reads
 * strongly-typed layout properties via layout.get(). Here we accept `any` to avoid
 * pulling in MapLibre's style evaluation types. The runtime behaviour is identical.
 */
export function getOverlapMode(
    layout: any,
    overlapProp: 'icon-overlap' | 'text-overlap',
    allowOverlapProp: 'icon-allow-overlap' | 'text-allow-overlap'
): OverlapMode {
    let result: OverlapMode = 'never';
    const overlap = layout.get(overlapProp);

    if (overlap) {
        // if -overlap is set, use it
        result = overlap;
    } else if (layout.get(allowOverlapProp)) {
        // fall back to -allow-overlap, with false='never', true='always'
        result = 'always';
    }

    return result;
}
