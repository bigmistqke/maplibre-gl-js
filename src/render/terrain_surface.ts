import {mat4} from 'gl-matrix';
import {drawDepth, drawCoords} from './draw_terrain';
import type {Surface} from '../core/surface';
import type {ShaderExtension} from '../core/shader_extension';
import type {Terrain, TerrainData} from './terrain';
import type {RenderToTexture} from './render_to_texture';
import type {Painter, RenderOptions} from './painter';
import type {Style} from '../style/style';
import type {StyleLayer} from '../style/style_layer';
import type {LngLat} from '../geo/lng_lat';
import type {MercatorCoordinate} from '../geo/mercator_coordinate';
import type {OverscaledTileID} from '../tile/tile_id';
import type {IReadonlyTransform} from '../geo/transform_interface';
import type Point from '@mapbox/point-geometry';

const TERRAIN_SHADER_EXTENSION: ShaderExtension = {
    key: 'terrain',
    defines: ['#define TERRAIN3D;'],
};

/**
 * Surface implementation backed by a 3D terrain DEM mesh.
 * Wraps the existing {@link Terrain} class, delegating all calls.
 */
export class TerrainSurface implements Surface {
    readonly hasTerrain = true;
    readonly shaderExtensions: readonly ShaderExtension[] = [TERRAIN_SHADER_EXTENSION];
    renderToTexture: RenderToTexture | null = null;
    private _terrain: Terrain;
    private _transform: IReadonlyTransform;
    private _facilitator = {dirty: true, matrix: mat4.identity(new Float64Array(16) as any), renderTime: 0};

    constructor(terrain: Terrain) {
        this._terrain = terrain;
    }

    get terrain(): Terrain { return this._terrain; }
    get skipOpaquePass(): boolean { return this.renderToTexture != null; }

    markDirty(): void { this._facilitator.dirty = true; }

    update(transform: IReadonlyTransform): void {
        this._transform = transform;
    }

    getElevation(lnglat: LngLat): number {
        return this._terrain.getElevationForLngLat(lnglat, this._transform);
    }

    getElevationForZoom(lnglat: LngLat, zoom: number): number {
        return this._terrain.getElevationForLngLatZoom(lnglat, zoom);
    }

    getMinElevationForZoom(lnglat: LngLat, zoom: number): number {
        return this._terrain.getMinTileElevationForLngLatZoom(lnglat, zoom);
    }

    getElevationForTile(tileID: OverscaledTileID, x: number, y: number, extent?: number): number {
        return this._terrain.getElevation(tileID, x, y, extent);
    }

    getMinMaxElevation(tileID: OverscaledTileID): {min: number; max: number} {
        const result = this._terrain.getMinMaxElevation(tileID);
        return {min: result.minElevation ?? 0, max: result.maxElevation ?? 0};
    }

    screenToCoordinate(point: Point): MercatorCoordinate | null {
        return this._terrain.pointCoordinate(point);
    }

    depthAtPoint(point: Point): number {
        return this._terrain.depthAtPoint(point);
    }

    isPointOnSurface(point: Point): boolean {
        return this._terrain.pointCoordinate(point) != null;
    }

    getBindings(tileID: OverscaledTileID): TerrainData | null {
        return this._terrain.getTerrainData(tileID);
    }

    prepareFrame(painter: Painter, style: Style): void {
        this._updateDepthAndCoords(painter, false);
        if (this.renderToTexture) {
            this.renderToTexture.prepareForRender(style, painter.transform.zoom);
        }
    }

    renderLayer(layer: StyleLayer, renderOptions: RenderOptions): boolean {
        return this.renderToTexture?.renderLayer(layer, renderOptions) ?? false;
    }

    ensureFrameBuffers(painter: Painter): void {
        this._updateDepthAndCoords(painter, true);
    }

    private _updateDepthAndCoords(painter: Painter, requireExact: boolean): void {
        const prevMatrix = this._facilitator.matrix;
        const currMatrix = painter.transform.modelViewProjectionMatrix;

        let doUpdate = this._facilitator.dirty;
        doUpdate ||= requireExact ? !mat4.exactEquals(prevMatrix, currMatrix) : !mat4.equals(prevMatrix, currMatrix);
        doUpdate ||= this._terrain.tileManager.anyTilesAfterTime(this._facilitator.renderTime);

        if (!doUpdate) {
            return;
        }

        mat4.copy(prevMatrix, currMatrix);
        this._facilitator.renderTime = Date.now();
        this._facilitator.dirty = false;
        drawDepth(painter, this._terrain);
        drawCoords(painter, this._terrain);
    }
}
