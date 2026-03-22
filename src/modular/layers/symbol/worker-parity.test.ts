/**
 * Worker layout parity test.
 *
 * Compares anchor counts between our worker's _runLayout and MapLibre's
 * getAnchors for the same tile, same font, same parameters.
 */
import {describe, it, expect} from 'vitest';
import {readFileSync} from 'fs';
import {resolve} from 'path';
import {VectorTile} from '@mapbox/vector-tile';
import Pbf from 'pbf';

import {getAnchors} from '../../../symbol/get_anchors.ts';
import {clipLine} from '../../../symbol/clip_line.ts';
import {shapeText, WritingMode} from '../../../symbol/shaping.ts';
import {Formatted, FormattedSection} from '@maplibre/maplibre-gl-style-spec';
import ONE_EM from '../../../symbol/one_em.ts';

import {clipLine as modularClipLine} from '@modular/layers/symbol/vendor/clip_line.ts';
import {getLineAnchors, shapeTextForLayout} from '@modular/layers/symbol/vendor/symbol_layout_helpers.ts';
import {mergeLines} from '@modular/layers/symbol/vendor/merge_lines.ts';
import type {GlyphMap, GlyphPositions, StyleGlyph} from '@modular/layers/symbol/types.ts';

const TILE_EXTENT = 4096;
const FONT_SIZE = 12;
const FONTSTACK = 'Open Sans Regular';

// Load real glyphs
function parseGlyphPbf(data: ArrayBuffer | Uint8Array): StyleGlyph[] {
    const BORDER = 3;
    const glyphs: StyleGlyph[] = [];
    function readFontstacks(tag: number, _: any, pbf: any) { if (tag === 1) pbf.readMessage(readFontstack, null); }
    function readFontstack(tag: number, _: any, pbf: any) { if (tag === 3) { const raw: any = {}; pbf.readMessage(readGlyph, raw); const {id, bitmap, width = 0, height = 0, left = 0, top = 0, advance = 0} = raw; const w = width + 2 * BORDER; const h = height + 2 * BORDER; const data = (bitmap && bitmap.length === w * h) ? bitmap : new Uint8Array(w * h); glyphs.push({id, bitmap: {width: w, height: h, data}, metrics: {width, height, left, top, advance}}); } }
    function readGlyph(tag: number, glyph: any, pbf: any) { if (tag === 1) glyph.id = pbf.readVarint(); else if (tag === 2) glyph.bitmap = pbf.readBytes(); else if (tag === 3) glyph.width = pbf.readVarint(); else if (tag === 4) glyph.height = pbf.readVarint(); else if (tag === 5) glyph.left = pbf.readSVarint(); else if (tag === 6) glyph.top = pbf.readSVarint(); else if (tag === 7) glyph.advance = pbf.readVarint(); }
    new Pbf(data).readFields(readFontstacks, null);
    return glyphs;
}

function loadGlyphs(): { glyphMap: GlyphMap; glyphPositions: GlyphPositions } {
    const glyphDir = resolve('test/integration/assets/glyphs/Noto Sans Regular');
    const ranges = ['0-255', '256-511'];
    const glyphMap: GlyphMap = {[FONTSTACK]: {}};
    const glyphPositions: GlyphPositions = {[FONTSTACK]: {}};
    for (const range of ranges) {
        try {
            const data = readFileSync(resolve(glyphDir, `${range}.pbf`));
            const parsed = parseGlyphPbf(new Uint8Array(data.buffer, data.byteOffset, data.byteLength));
            for (const g of parsed) {
                glyphMap[FONTSTACK][g.id] = g;
                glyphPositions[FONTSTACK][g.id] = {rect: {x: 0, y: 0, w: g.bitmap.width, h: g.bitmap.height}, metrics: g.metrics};
            }
        } catch { /* skip */ }
    }
    return {glyphMap, glyphPositions};
}

function resolveTextField(template: string, props: Record<string, any>): string | null {
    const text = template.replace(/\{([^}]+)\}/g, (_, k) => String(props[k] ?? '')).trim();
    return text.length > 0 ? text : null;
}

function shapeOriginal(text: string, glyphMap: GlyphMap, glyphPositions: GlyphPositions) {
    const formatted = new Formatted([new FormattedSection(text, null, null, null, null, null)]);
    return shapeText(formatted, glyphMap as any, glyphPositions, {}, FONTSTACK, Infinity, 24, 'center', 'center', 0, [0, 0], WritingMode.horizontal, false, ONE_EM, ONE_EM);
}

describe('Worker layout parity', () => {
    const {glyphMap, glyphPositions} = loadGlyphs();

    it('per-tile anchor counts match between original and modular', () => {
        const tilePath = resolve('test/unit/assets/versatiles-14-8414-5384.pbf');
        const tileBytes = readFileSync(tilePath);
        const tile = new VectorTile(new Pbf(new Uint8Array(tileBytes.buffer, tileBytes.byteOffset, tileBytes.byteLength)));
        const layer = tile.layers['street_labels'];

        const features: Array<{ geometry: any; text: string }> = [];
        for (let i = 0; i < layer.length; i++) {
            const feat = layer.feature(i);
            if (feat.type !== 2) continue;
            const text = resolveTextField('{name}', feat.properties);
            if (!text) continue;
            features.push({geometry: feat.loadGeometry(), text});
        }

        // Both merge first (MapLibre merges in symbol_bucket.ts:545)
        const merged = mergeLines(features as any) as any[];

        // MapLibre parameters
        const overscaling = 1;
        const tilePixelRatio = TILE_EXTENT / (512 * overscaling); // 8
        const textMaxSize = FONT_SIZE; // constant text-size
        const glyphSize = ONE_EM;
        const textMaxBoxScale = tilePixelRatio * textMaxSize / glyphSize;
        const symbolMinDistance = tilePixelRatio * 250; // default symbol-spacing
        const textMaxAngle = 45 * Math.PI / 180;

        let originalAnchors = 0;
        let modularAnchors = 0;
        const perFeature: Array<{ text: string; original: number; modular: number }> = [];

        for (const feat of merged) {
            const geom = feat.geometry;
            if (!geom || geom.length === 0) continue;

            const origShaping = shapeOriginal(feat.text, glyphMap, glyphPositions);
            const modShaping = shapeTextForLayout({
                text: feat.text, glyphMap, glyphPositions, fontstack: FONTSTACK,
                fontSize: FONT_SIZE, alongLine: true,
            });

            if (!origShaping && !modShaping) continue;

            let origCount = 0;
            let modCount = 0;

            for (const ring of geom) {
                if (ring.length < 2) continue;

                if (origShaping) {
                    const clipped = clipLine([ring], 0, 0, TILE_EXTENT, TILE_EXTENT);
                    for (const line of clipped) {
                        if (line.length < 2) continue;
                        origCount += getAnchors(line, symbolMinDistance, textMaxAngle, origShaping, undefined as any, glyphSize, textMaxBoxScale, overscaling, TILE_EXTENT).length;
                    }
                }

                if (modShaping) {
                    const clipped = modularClipLine([ring], 0, 0, TILE_EXTENT, TILE_EXTENT);
                    for (const line of clipped) {
                        if (line.length < 2) continue;
                        modCount += getLineAnchors({line, symbolMinDistance: symbolMinDistance, textMaxAngle, shaping: modShaping, fontSize: FONT_SIZE, extent: TILE_EXTENT}).length;
                    }
                }
            }

            originalAnchors += origCount;
            modularAnchors += modCount;
            if (origCount !== modCount) {
                perFeature.push({text: feat.text, original: origCount, modular: modCount});
            }
        }

        console.log(`Original: ${originalAnchors}, Modular: ${modularAnchors}`);
        if (perFeature.length > 0) {
            console.log(`Mismatches (${perFeature.length}):`);
            for (const f of perFeature.slice(0, 10)) {
                console.log(`  "${f.text}": orig=${f.original} mod=${f.modular}`);
            }
        }

        expect(modularAnchors).toBe(originalAnchors);
    });
});
