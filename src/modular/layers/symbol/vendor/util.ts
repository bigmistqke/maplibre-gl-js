// Vendored from MapLibre GL JS — do not edit directly.
// Sources:
//   src/util/util.ts            — findLineIntersection, translatePosition, warnOnce
//   src/data/bucket/symbol_bucket.ts — addDynamicAttributes
//   src/source/pixels_to_tile_units.ts — pixelsToTileUnits

import Point from '@mapbox/point-geometry';
import type { StructArray } from '@modular/core/struct-array.ts';
import { TILE_EXTENT } from '@modular/core/constants.ts';

// ---------------------------------------------------------------------------
// pixelsToTileUnits
// ---------------------------------------------------------------------------

/**
 * Converts a pixel value at the given zoom level to tile units.
 *
 * The shaders mostly calculate everything in tile units so style
 * properties need to be converted from pixels to tile units using this.
 *
 * @returns value in tile units
 */
export function pixelsToTileUnits(
    tile: {
        tileID: { overscaledZ: number };
        tileSize: number;
    },
    pixelValue: number,
    z: number
): number {
    return pixelValue * (TILE_EXTENT / (tile.tileSize * Math.pow(2, z - tile.tileID.overscaledZ)));
}

// ---------------------------------------------------------------------------
// translatePosition
// ---------------------------------------------------------------------------

/**
 * Returns a translation in tile units that correctly incorporates the view
 * angle and the *-translate and *-translate-anchor properties.
 *
 * @param inViewportPixelUnitsUnits - True when the units accepted by the matrix
 *   are in viewport pixels instead of tile units.
 */
export function translatePosition(
    transform: { bearingInRadians: number; zoom: number },
    tile: { tileID: { overscaledZ: number }; tileSize: number },
    translate: [number, number],
    translateAnchor: 'map' | 'viewport',
    inViewportPixelUnitsUnits: boolean = false
): [number, number] {
    if (!translate[0] && !translate[1]) return [0, 0];

    const angle = inViewportPixelUnitsUnits ?
        (translateAnchor === 'map' ? -transform.bearingInRadians : 0) :
        (translateAnchor === 'viewport' ? transform.bearingInRadians : 0);

    if (angle) {
        const sinA = Math.sin(angle);
        const cosA = Math.cos(angle);
        translate = [
            translate[0] * cosA - translate[1] * sinA,
            translate[0] * sinA + translate[1] * cosA
        ];
    }

    return [
        inViewportPixelUnitsUnits ? translate[0] : pixelsToTileUnits(tile, translate[0], transform.zoom),
        inViewportPixelUnitsUnits ? translate[1] : pixelsToTileUnits(tile, translate[1], transform.zoom)
    ];
}

// ---------------------------------------------------------------------------
// warnOnce
// ---------------------------------------------------------------------------

const warnOnceHistory: { [key: string]: boolean } = {};

/**
 * Print a warning message to the console and ensure duplicate warning messages
 * are not printed.
 */
export function warnOnce(message: string): void {
    if (!warnOnceHistory[message]) {
        // console isn't defined in some WebWorkers, see #2558
        if (typeof console !== 'undefined') console.warn(message);
        warnOnceHistory[message] = true;
    }
}

// ---------------------------------------------------------------------------
// findLineIntersection
// ---------------------------------------------------------------------------

/**
 * For two lines a and b in 2d space, defined by any two points along the lines,
 * find the intersection point, or return null if the lines are parallel.
 *
 * @param a1 - First point on line a
 * @param a2 - Second point on line a
 * @param b1 - First point on line b
 * @param b2 - Second point on line b
 *
 * @returns the intersection point of the two lines or null if they are parallel
 */
export function findLineIntersection(a1: Point, a2: Point, b1: Point, b2: Point): Point | null {
    const aDeltaY = a2.y - a1.y;
    const aDeltaX = a2.x - a1.x;
    const bDeltaY = b2.y - b1.y;
    const bDeltaX = b2.x - b1.x;

    const denominator = (bDeltaY * aDeltaX) - (bDeltaX * aDeltaY);

    if (denominator === 0) {
        // Lines are parallel
        return null;
    }

    const originDeltaY = a1.y - b1.y;
    const originDeltaX = a1.x - b1.x;
    const aInterpolation = (bDeltaX * originDeltaY - bDeltaY * originDeltaX) / denominator;

    // Find intersection by projecting out from origin of first segment
    return new Point(a1.x + (aInterpolation * aDeltaX), a1.y + (aInterpolation * aDeltaY));
}

// ---------------------------------------------------------------------------
// addDynamicAttributes
// ---------------------------------------------------------------------------

/**
 * Adds 4 copies of (x, y, angle) to a dynamic layout vertex array.
 * One copy per vertex of the quad (tl, tr, bl, br).
 */
export function addDynamicAttributes(dynamicLayoutVertexArray: StructArray<string>, p: Point, angle: number): void {
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
    dynamicLayoutVertexArray.emplaceBack(p.x, p.y, angle);
}
