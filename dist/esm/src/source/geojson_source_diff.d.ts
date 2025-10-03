export type GeoJSONFeatureId = number | string;
export type GeoJSONSourceDiff = {
    removeAll?: boolean;
    remove?: Array<GeoJSONFeatureId>;
    add?: Array<GeoJSON.Feature>;
    update?: Array<GeoJSONFeatureDiff>;
};
export type GeoJSONFeatureDiff = {
    id: GeoJSONFeatureId;
    newGeometry?: GeoJSON.Geometry;
    removeAllProperties?: boolean;
    removeProperties?: Array<string>;
    addOrUpdateProperties?: Array<{
        key: string;
        value: any;
    }>;
};
export type UpdateableGeoJSON = GeoJSON.Feature | GeoJSON.FeatureCollection | undefined;
export declare function isUpdateableGeoJSON(data: GeoJSON.GeoJSON | undefined, promoteId?: string): data is UpdateableGeoJSON;
export declare function toUpdateable(data: UpdateableGeoJSON, promoteId?: string): Map<GeoJSONFeatureId, import("geojson").Feature<import("geojson").Geometry, {
    [name: string]: any;
}>>;
export declare function applySourceDiff(updateable: Map<GeoJSONFeatureId, GeoJSON.Feature>, diff: GeoJSONSourceDiff, promoteId?: string): void;
export declare function mergeSourceDiffs(existingDiff: GeoJSONSourceDiff | undefined, newDiff: GeoJSONSourceDiff | undefined): GeoJSONSourceDiff;
//# sourceMappingURL=geojson_source_diff.d.ts.map