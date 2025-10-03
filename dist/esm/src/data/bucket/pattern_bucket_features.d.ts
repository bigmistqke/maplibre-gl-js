import type { FillStyleLayer } from '../../style/style_layer/fill_style_layer';
import type { FillExtrusionStyleLayer } from '../../style/style_layer/fill_extrusion_style_layer';
import type { LineStyleLayer } from '../../style/style_layer/line_style_layer';
import type { BucketFeature, PopulateParameters } from '../bucket';
type PatternStyleLayers = Array<LineStyleLayer> | Array<FillStyleLayer> | Array<FillExtrusionStyleLayer>;
export declare function hasPattern(type: string, layers: PatternStyleLayers, options: PopulateParameters): boolean;
export declare function addPatternDependencies(type: string, layers: PatternStyleLayers, patternFeature: BucketFeature, parameters: {
    zoom: number;
}, options: PopulateParameters): BucketFeature;
export {};
//# sourceMappingURL=pattern_bucket_features.d.ts.map