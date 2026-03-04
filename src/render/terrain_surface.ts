import type {Surface} from '../core/surface';
import type {Terrain, TerrainData} from './terrain';
import type {RenderToTexture} from './render_to_texture';
import type {LngLat} from '../geo/lng_lat';
import type {MercatorCoordinate} from '../geo/mercator_coordinate';
import type {OverscaledTileID} from '../tile/tile_id';
import type {IReadonlyTransform} from '../geo/transform_interface';
import type Point from '@mapbox/point-geometry';

/**
 * Surface implementation backed by a 3D terrain DEM mesh.
 * Wraps the existing {@link Terrain} class, delegating all calls.
 */
export class TerrainSurface implements Surface {
    readonly hasTerrain = true;
    renderToTexture: RenderToTexture | null = null;
    private _terrain: Terrain;
    private _transform: IReadonlyTransform;

    constructor(terrain: Terrain) {
        this._terrain = terrain;
    }

    get terrain(): Terrain { return this._terrain; }

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
}
