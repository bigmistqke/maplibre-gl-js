import { type Tile } from '../source/tile';
import { mat4 } from 'gl-matrix';
import { OverscaledTileID } from '../source/tile_id';
import { type Painter } from './painter';
import { Texture } from '../render/texture';
import type { Framebuffer } from '../gl/framebuffer';
import type Point from '@mapbox/point-geometry';
import { MercatorCoordinate } from '../geo/mercator_coordinate';
import { TerrainSourceCache } from '../source/terrain_source_cache';
import { type SourceCache } from '../source/source_cache';
import type { TerrainSpecification } from '@maplibre/maplibre-gl-style-spec';
import { type LngLat } from '../geo/lng_lat';
import { Mesh } from './mesh';
export type TerrainData = {
    'u_depth': number;
    'u_terrain': number;
    'u_terrain_dim': number;
    'u_terrain_matrix': mat4;
    'u_terrain_unpack': number[];
    'u_terrain_exaggeration': number;
    texture: WebGLTexture;
    depthTexture: WebGLTexture;
    tile: Tile;
};
export declare class Terrain {
    painter: Painter;
    sourceCache: TerrainSourceCache;
    options: TerrainSpecification;
    meshSize: number;
    exaggeration: number;
    qualityFactor: number;
    _fbo: Framebuffer;
    _fboCoordsTexture: Texture;
    _fboDepthTexture: Texture;
    _emptyDepthTexture: Texture;
    _meshCache: {
        [key: string]: Mesh;
    };
    coordsIndex: Array<string>;
    _coordsTexture: Texture;
    _coordsTextureSize: number;
    _emptyDemUnpack: number[];
    _emptyDemTexture: Texture;
    _emptyDemMatrix: mat4;
    _demMatrixCache: {
        [_: string]: {
            matrix: mat4;
            coord: OverscaledTileID;
        };
    };
    constructor(painter: Painter, sourceCache: SourceCache, options: TerrainSpecification);
    getDEMElevation(tileID: OverscaledTileID, x: number, y: number, extent?: number): number;
    getElevationForLngLatZoom(lnglat: LngLat, zoom: number): number;
    getElevation(tileID: OverscaledTileID, x: number, y: number, extent?: number): number;
    getTerrainData(tileID: OverscaledTileID): TerrainData;
    getFramebuffer(texture: string): Framebuffer;
    getCoordsTexture(): Texture;
    pointCoordinate(p: Point): MercatorCoordinate;
    depthAtPoint(p: Point): number;
    getTerrainMesh(tileId: OverscaledTileID): Mesh;
    getMeshFrameDelta(zoom: number): number;
    getMinTileElevationForLngLatZoom(lnglat: LngLat, zoom: number): number;
    getMinMaxElevation(tileID: OverscaledTileID): {
        minElevation: number | null;
        maxElevation: number | null;
    };
    _getOverscaledTileIDFromLngLatZoom(lnglat: LngLat, zoom: number): {
        tileID: OverscaledTileID;
        mercatorX: number;
        mercatorY: number;
    };
}
//# sourceMappingURL=terrain.d.ts.map