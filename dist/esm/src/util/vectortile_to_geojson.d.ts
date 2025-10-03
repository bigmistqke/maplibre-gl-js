import type { VectorTileFeature } from '@mapbox/vector-tile';
import type { LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
export type DistributiveKeys<T> = T extends T ? keyof T : never;
export type DistributiveOmit<T, K extends DistributiveKeys<T>> = T extends unknown ? Omit<T, K> : never;
export type MapGeoJSONFeature = GeoJSONFeature & {
    layer: DistributiveOmit<LayerSpecification, 'source'> & {
        source: string;
    };
    source: string;
    sourceLayer?: string;
    state: {
        [key: string]: any;
    };
};
export declare class GeoJSONFeature {
    type: 'Feature';
    _geometry: GeoJSON.Geometry;
    properties: {
        [name: string]: any;
    };
    id: number | string | undefined;
    _vectorTileFeature: VectorTileFeature;
    constructor(vectorTileFeature: VectorTileFeature, z: number, x: number, y: number, id: string | number | undefined);
    get geometry(): GeoJSON.Geometry;
    set geometry(g: GeoJSON.Geometry);
    toJSON(): any;
}
//# sourceMappingURL=vectortile_to_geojson.d.ts.map