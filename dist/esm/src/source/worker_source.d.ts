import type { ExpiryData, RequestParameters } from '../util/ajax';
import type { RGBAImage, AlphaImage } from '../util/image';
import type { GlyphPositions } from '../render/glyph_atlas';
import type { ImageAtlas } from '../render/image_atlas';
import type { OverscaledTileID } from './tile_id';
import type { Bucket } from '../data/bucket';
import type { FeatureIndex } from '../data/feature_index';
import type { CollisionBoxArray } from '../data/array_types.g';
import type { DEMEncoding } from '../data/dem_data';
import type { StyleGlyph } from '../style/style_glyph';
import type { StyleImage } from '../style/style_image';
import type { PromoteIdSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { RemoveSourceParams } from '../util/actor_messages';
import type { IActor } from '../util/actor';
import type { StyleLayerIndex } from '../style/style_layer_index';
import type { SubdivisionGranularitySetting } from '../render/subdivision_granularity_settings';
export type TileParameters = {
    type: string;
    source: string;
    uid: string | number;
};
export type WorkerTileParameters = TileParameters & {
    tileID: OverscaledTileID;
    request?: RequestParameters;
    zoom: number;
    maxZoom?: number;
    tileSize: number;
    promoteId: PromoteIdSpecification;
    pixelRatio: number;
    showCollisionBoxes: boolean;
    collectResourceTiming?: boolean;
    returnDependencies?: boolean;
    subdivisionGranularity: SubdivisionGranularitySetting;
};
export type WorkerDEMTileParameters = TileParameters & {
    rawImageData: RGBAImage | ImageBitmap | ImageData;
    encoding: DEMEncoding;
    redFactor: number;
    greenFactor: number;
    blueFactor: number;
    baseShift: number;
};
export type WorkerTileResult = ExpiryData & {
    buckets: Array<Bucket>;
    imageAtlas: ImageAtlas;
    glyphAtlasImage: AlphaImage;
    featureIndex: FeatureIndex;
    collisionBoxArray: CollisionBoxArray;
    rawTileData?: ArrayBuffer;
    resourceTiming?: Array<PerformanceResourceTiming>;
    glyphMap?: {
        [_: string]: {
            [_: number]: StyleGlyph;
        };
    } | null;
    iconMap?: {
        [_: string]: StyleImage;
    } | null;
    glyphPositions?: GlyphPositions | null;
};
export interface WorkerSourceConstructor {
    new (actor: IActor, layerIndex: StyleLayerIndex, availableImages: Array<string>): WorkerSource;
}
export interface WorkerSource {
    availableImages: Array<string>;
    loadTile(params: WorkerTileParameters): Promise<WorkerTileResult>;
    reloadTile(params: WorkerTileParameters): Promise<WorkerTileResult>;
    abortTile(params: TileParameters): Promise<void>;
    removeTile(params: TileParameters): Promise<void>;
    removeSource?: (params: RemoveSourceParams) => Promise<void>;
}
//# sourceMappingURL=worker_source.d.ts.map