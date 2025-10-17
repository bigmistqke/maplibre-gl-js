import { StyleLayer, type QueryIntersectsFeatureParams } from '../style_layer';
import type { CircleBucket } from '../../data/bucket/circle_bucket';
import { type CircleLayoutPropsPossiblyEvaluated, type CirclePaintPropsPossiblyEvaluated } from './circle_style_layer_properties.g';
import { type Transitionable, type Transitioning, type Layout, type PossiblyEvaluated } from '../properties';
import type { LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Bucket, BucketParameters } from '../../data/bucket';
import type { CircleLayoutProps, CirclePaintProps } from './circle_style_layer_properties.g';
export declare const isCircleStyleLayer: (layer: StyleLayer) => layer is CircleStyleLayer;
export declare class CircleStyleLayer extends StyleLayer {
    _unevaluatedLayout: Layout<CircleLayoutProps>;
    layout: PossiblyEvaluated<CircleLayoutProps, CircleLayoutPropsPossiblyEvaluated>;
    _transitionablePaint: Transitionable<CirclePaintProps>;
    _transitioningPaint: Transitioning<CirclePaintProps>;
    paint: PossiblyEvaluated<CirclePaintProps, CirclePaintPropsPossiblyEvaluated>;
    constructor(layer: LayerSpecification, globalState: Record<string, any>);
    createBucket(parameters: BucketParameters<any>): CircleBucket<any>;
    queryRadius(bucket: Bucket): number;
    queryIntersectsFeature({ queryGeometry, feature, featureState, geometry, transform, pixelsToTileUnits, unwrappedTileID, getElevation }: QueryIntersectsFeatureParams): boolean;
}
//# sourceMappingURL=circle_style_layer.d.ts.map