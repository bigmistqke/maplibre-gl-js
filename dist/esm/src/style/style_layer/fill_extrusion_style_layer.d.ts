import { type QueryIntersectsFeatureParams, StyleLayer } from '../style_layer';
import { FillExtrusionBucket } from '../../data/bucket/fill_extrusion_bucket';
import { type FillExtrusionPaintPropsPossiblyEvaluated } from './fill_extrusion_style_layer_properties.g';
import { type Transitionable, type Transitioning, type PossiblyEvaluated } from '../properties';
import Point from '@mapbox/point-geometry';
import type { LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { BucketParameters } from '../../data/bucket';
import type { FillExtrusionPaintProps } from './fill_extrusion_style_layer_properties.g';
export declare class Point3D extends Point {
    z: number;
}
export declare const isFillExtrusionStyleLayer: (layer: StyleLayer) => layer is FillExtrusionStyleLayer;
export declare class FillExtrusionStyleLayer extends StyleLayer {
    _transitionablePaint: Transitionable<FillExtrusionPaintProps>;
    _transitioningPaint: Transitioning<FillExtrusionPaintProps>;
    paint: PossiblyEvaluated<FillExtrusionPaintProps, FillExtrusionPaintPropsPossiblyEvaluated>;
    constructor(layer: LayerSpecification, globalState: Record<string, any>);
    createBucket(parameters: BucketParameters<FillExtrusionStyleLayer>): FillExtrusionBucket;
    queryRadius(): number;
    is3D(): boolean;
    queryIntersectsFeature({ queryGeometry, feature, featureState, geometry, transform, pixelsToTileUnits, pixelPosMatrix }: QueryIntersectsFeatureParams): boolean | number;
}
export declare function getIntersectionDistance(projectedQueryGeometry: Array<Point3D>, projectedFace: Array<Point3D>): number;
//# sourceMappingURL=fill_extrusion_style_layer.d.ts.map