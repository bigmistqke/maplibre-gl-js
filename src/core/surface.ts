import type {LngLat} from '../geo/lng_lat';
import type {MercatorCoordinate} from '../geo/mercator_coordinate';
import type {OverscaledTileID} from '../tile/tile_id';
import type {TerrainData, Terrain} from '../render/terrain';
import type {RenderToTexture} from '../render/render_to_texture';
import type {IReadonlyTransform, ITransform} from '../geo/transform_interface';
import type {Painter} from '../render/painter';
import type {ShaderExtension} from './shader_extension';
import type Point from '@mapbox/point-geometry';

/**
 * A Surface describes the world's geometry. Without terrain the world is flat
 * (FlatSurface). With terrain it's a 3D DEM mesh (TerrainSurface). The rest of
 * the codebase talks to Surface uniformly and never branches on which
 * implementation is active.
 */
export interface Surface {
    /** Shader extensions provided by this surface (e.g. terrain defines). */
    readonly shaderExtensions: readonly ShaderExtension[];

    /** Elevation at a point, using the current zoom level. Returns 0 for flat. */
    getElevation(lnglat: LngLat): number;

    /** Elevation at a point for a specific zoom level. */
    getElevationForZoom(lnglat: LngLat, zoom: number): number;

    /** Minimum tile elevation at a point for a specific zoom (for camera clamping). */
    getMinElevationForZoom(lnglat: LngLat, zoom: number): number;

    /** Tile-space elevation (for symbol placement). */
    getElevationForTile(tileID: OverscaledTileID, x: number, y: number, extent?: number): number;

    /** Returns an elevation callback for the given tile, or null for flat surfaces. */
    getElevationCallback(tileID: OverscaledTileID): ((x: number, y: number) => number) | null;

    /** Min/max elevation in a tile (for frustum culling). */
    getMinMaxElevation(tileID: OverscaledTileID): {min: number; max: number};

    /** Map a screen point to a world coordinate. Returns null if no hit. */
    screenToCoordinate(point: Point): MercatorCoordinate | null;

    /** Depth value at a screen point (for marker occlusion). */
    depthAtPoint(point: Point): number;

    /**
     * Check if a marker at the given screen position is occluded by the surface.
     * Returns `{base: false, center: false}` for flat surfaces.
     * For terrain, compares depth buffer values against camera depth.
     */
    isOccluded(screenPos: Point, lngLat: LngLat, offset: Point, transform: IReadonlyTransform): {base: boolean; center: boolean};

    /** Whether a screen point hits the surface (for gesture handling). */
    isPointOnSurface(point: Point): boolean;

    /** Per-tile GPU bindings (DEM textures + uniforms) for shader draw calls. */
    getBindings(tileID: OverscaledTileID): TerrainData | null;

    /** Render-to-texture manager for terrain rendering, or null for flat. */
    readonly renderToTexture: RenderToTexture | null;

    /** Direct access to the underlying Terrain object (for FBO management). Null for flat. */
    readonly terrain: Terrain | null;

    /** Called once per frame to sync elevation with the transform. */
    update(transform: ITransform, centerClampedToGround: boolean): void;

    // === Render strategy ===

    /**
     * Drive the render loop for this frame. Surface owns the pass structure:
     * FlatSurface uses the standard offscreen → opaque → translucent passes.
     * TerrainSurface uses RTT tile-based rendering.
     */
    renderFrame(painter: Painter): void;

    /** Force-update depth/coords FBOs (e.g. before reading coords pixel). */
    ensureFrameBuffers(painter: Painter): void;

    /** Mark depth/coords FBOs as needing a redraw (e.g. after terrain data change). */
    markDirty(): void;

    /** Whether tile covering should use variable zoom levels across the viewport. */
    allowVariableZoom(): boolean;

    // === Elevation controller ===

    /**
     * Freeze elevation updates (e.g. during drag gestures or camera animations).
     * Prevents elevation jitter from terrain data arriving mid-interaction.
     */
    freezeElevation(): void;

    /** Resume elevation updates after a gesture or animation completes. */
    unfreezeElevation(): void;

    /** Whether elevation updates are currently frozen. */
    readonly isElevationFrozen: boolean;
}

/**
 * Zero-cost surface for a flat world. All elevation returns 0, all picking
 * returns null, no GPU bindings.
 */
export class FlatSurface implements Surface {
    readonly shaderExtensions: readonly ShaderExtension[] = [];
    readonly renderToTexture: RenderToTexture | null = null;
    readonly terrain: Terrain | null = null;

    getElevation(_lnglat: LngLat): number { return 0; }
    getElevationForZoom(_lnglat: LngLat, _zoom: number): number { return 0; }
    getMinElevationForZoom(_lnglat: LngLat, _zoom: number): number { return 0; }
    getElevationForTile(_tileID: OverscaledTileID, _x: number, _y: number, _extent?: number): number { return 0; }
    getElevationCallback(_tileID: OverscaledTileID): ((x: number, y: number) => number) | null { return null; }
    getMinMaxElevation(_tileID: OverscaledTileID): {min: number; max: number} { return {min: 0, max: 0}; }
    screenToCoordinate(_point: Point): MercatorCoordinate | null { return null; }
    depthAtPoint(_point: Point): number { return 0; }
    isOccluded(_screenPos: Point, _lngLat: LngLat, _offset: Point, _transform: IReadonlyTransform): {base: boolean; center: boolean} { return {base: false, center: false}; }
    isPointOnSurface(_point: Point): boolean { return true; }
    getBindings(_tileID: OverscaledTileID): TerrainData | null { return null; }
    update(_transform: ITransform, _centerClampedToGround: boolean): void {}
    renderFrame(painter: Painter): void { painter._renderPasses(); }
    ensureFrameBuffers(_painter: Painter): void {}
    markDirty(): void {}
    allowVariableZoom(): boolean { return false; }
    freezeElevation(): void {}
    unfreezeElevation(): void {}
    readonly isElevationFrozen = false;
}

/** Singleton flat surface — avoids allocation. */
export const FLAT_SURFACE: Surface = new FlatSurface();
