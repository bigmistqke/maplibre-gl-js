import type Point from '@mapbox/point-geometry';
import type { VectorTileFeature } from '@mapbox/vector-tile';
import type { Feature } from '@maplibre/maplibre-gl-style-spec';
type EvaluationFeature = Feature & {
    geometry: Array<Array<Point>>;
};
export declare function toEvaluationFeature(feature: VectorTileFeature, needGeometry: boolean): EvaluationFeature;
export {};
//# sourceMappingURL=evaluation_feature.d.ts.map