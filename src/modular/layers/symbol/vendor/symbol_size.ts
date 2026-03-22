// Vendored from maplibre-gl-js
// Source: src/symbol/symbol_size.ts
// Modifications: import paths, type narrowing, STUB comments

import {Interpolate, interpolates} from '@maplibre/maplibre-gl-style-spec';

import type {InterpolationType} from '@maplibre/maplibre-gl-style-spec';

export const MAX_GLYPH_ICON_SIZE = 255;
export const SIZE_PACK_FACTOR = 128;
export const MAX_PACKED_SIZE = MAX_GLYPH_ICON_SIZE * SIZE_PACK_FACTOR;

export type SizeData = {
    kind: 'constant';
    layoutSize: number;
} | {
    kind: 'source';
} | {
    kind: 'camera';
    minZoom: number;
    maxZoom: number;
    minSize: number;
    maxSize: number;
    interpolationType: InterpolationType;
} | {
    kind: 'composite';
    minZoom: number;
    maxZoom: number;
    interpolationType: InterpolationType;
};

export type EvaluatedZoomSize = {uSizeT: number; uSize: number};

// STUB: getSizeData depends on style evaluation (PropertyValue, EvaluationParameters) —
// not vendored here; SizeData is constructed upstream by the symbol bucket
export function evaluateSizeForFeature(
    sizeData: SizeData,
    {uSize, uSizeT}: {uSize: number; uSizeT: number},
    {lowerSize, upperSize}: {lowerSize: number; upperSize: number}
): number {
    // STUB: source and composite kinds require packed sizes from the vertex buffer —
    // these are populated by the symbol bucket, which we don't fully replicate yet
    if (sizeData.kind === 'source') {
        return lowerSize / SIZE_PACK_FACTOR;
    } else if (sizeData.kind === 'composite') {
        return interpolates.number(lowerSize / SIZE_PACK_FACTOR, upperSize / SIZE_PACK_FACTOR, uSizeT);
    }
    return uSize;
}

export function evaluateSizeForZoom(sizeData: SizeData, zoom: number): EvaluatedZoomSize {
    // STUB: only handles constant size — zoom-dependent and feature-dependent sizes need style evaluation
    if (sizeData.kind === 'constant') {
        return {uSize: sizeData.layoutSize, uSizeT: 0};
    }

    if (sizeData.kind === 'source') {
        // STUB: source-driven size — uSize is unused, actual size comes from per-feature vertex data
        return {uSize: 0, uSizeT: 0};
    }

    // camera or composite
    const {interpolationType, minZoom, maxZoom} = sizeData;
    const t = !interpolationType ? 0 : Math.max(0, Math.min(1,
        Interpolate.interpolationFactor(interpolationType, zoom, minZoom, maxZoom)
    ));

    if (sizeData.kind === 'camera') {
        return {uSize: interpolates.number(sizeData.minSize, sizeData.maxSize, t), uSizeT: 0};
    }

    // composite
    return {uSize: 0, uSizeT: t};
}
