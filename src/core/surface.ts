import type {LngLat} from '../geo/lng_lat';
import type {MercatorCoordinate} from '../geo/mercator_coordinate';
import type {OverscaledTileID} from '../tile/tile_id';
import type {TerrainData, Terrain} from '../render/terrain';
import type {RenderToTexture} from '../render/render_to_texture';
import type {IReadonlyTransform} from '../geo/transform_interface';
import type {Painter, RenderOptions} from '../render/painter';
import type {Style} from '../style/style';
import type {StyleLayer} from '../style/style_layer';
import type {ShaderExtension} from './shader_extension';
import type Point from '@mapbox/point-geometry';

/**
 * A Surface describes the world's geometry. Without terrain the world is flat
 * (FlatSurface). With terrain it's a 3D DEM mesh (TerrainSurface). The rest of
 * the codebase talks to Surface uniformly and never branches on which
 * implementation is active.
 */
export interface Surface {
    /** Whether this surface provides 3D terrain elevation. */
    readonly hasTerrain: boolean;

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

    /** Min/max elevation in a tile (for frustum culling). */
    getMinMaxElevation(tileID: OverscaledTileID): {min: number; max: number};

    /** Map a screen point to a world coordinate. Returns null if no hit. */
    screenToCoordinate(point: Point): MercatorCoordinate | null;

    /** Depth value at a screen point (for marker occlusion). */
    depthAtPoint(point: Point): number;

    /** Whether a screen point hits the surface (for gesture handling). */
    isPointOnSurface(point: Point): boolean;

    /** Per-tile GPU bindings (DEM textures + uniforms) for shader draw calls. */
    getBindings(tileID: OverscaledTileID): TerrainData | null;

    /** Render-to-texture manager for terrain rendering, or null for flat. */
    readonly renderToTexture: RenderToTexture | null;

    /** Direct access to the underlying Terrain object (for FBO management). Null for flat. */
    readonly terrain: Terrain | null;

    /** Called once per frame to cache the current transform. */
    update(transform: IReadonlyTransform): void;

    // === Render strategy ===

    /** Whether the opaque pass should be skipped (e.g. when rendering to texture). */
    readonly skipOpaquePass: boolean;

    /** Called at the start of each frame. Handles FBO updates and RTT preparation. */
    prepareFrame(painter: Painter, style: Style): void;

    /** Returns true if this surface handled rendering the layer (e.g. via RTT). */
    renderLayer(layer: StyleLayer, renderOptions: RenderOptions): boolean;

    /** Force-update depth/coords FBOs (e.g. before reading coords pixel). */
    ensureFrameBuffers(painter: Painter): void;

    /** Mark depth/coords FBOs as needing a redraw (e.g. after terrain data change). */
    markDirty(): void;
}

/**
 * Zero-cost surface for a flat world. All elevation returns 0, all picking
 * returns null, no GPU bindings.
 */
export class FlatSurface implements Surface {
    readonly hasTerrain = false;
    readonly shaderExtensions: readonly ShaderExtension[] = [];
    readonly renderToTexture: RenderToTexture | null = null;
    readonly terrain: Terrain | null = null;
    readonly skipOpaquePass = false;

    getElevation(_lnglat: LngLat): number { return 0; }
    getElevationForZoom(_lnglat: LngLat, _zoom: number): number { return 0; }
    getMinElevationForZoom(_lnglat: LngLat, _zoom: number): number { return 0; }
    getElevationForTile(_tileID: OverscaledTileID, _x: number, _y: number, _extent?: number): number { return 0; }
    getMinMaxElevation(_tileID: OverscaledTileID): {min: number; max: number} { return {min: 0, max: 0}; }
    screenToCoordinate(_point: Point): MercatorCoordinate | null { return null; }
    depthAtPoint(_point: Point): number { return 0; }
    isPointOnSurface(_point: Point): boolean { return false; }
    getBindings(_tileID: OverscaledTileID): TerrainData | null { return null; }
    update(_transform: IReadonlyTransform): void {}
    prepareFrame(_painter: Painter, _style: Style): void {}
    renderLayer(_layer: StyleLayer, _renderOptions: RenderOptions): boolean { return false; }
    ensureFrameBuffers(_painter: Painter): void {}
    markDirty(): void {}
}

/** Singleton flat surface — avoids allocation. */
export const FLAT_SURFACE: Surface = new FlatSurface();
