import { PossiblyEvaluatedPropertyValue } from '../style/properties';
import { FeaturePositionMap } from './feature_position_map';
import { type Uniform } from '../render/uniform_binding';
import type { UniformLocations } from '../render/uniform_binding';
import type { CanonicalTileID } from '../source/tile_id';
import type { Context } from '../gl/context';
import type { TypedStyleLayer } from '../style/style_layer/typed_style_layer';
import type { CrossfadeParameters } from '../style/evaluation_parameters';
import type { VertexBuffer } from '../gl/vertex_buffer';
import type { ImagePosition } from '../render/image_atlas';
import type { Feature, FeatureState, GlobalProperties, FormattedSection } from '@maplibre/maplibre-gl-style-spec';
import type { FeatureStates } from '../source/source_state';
import type { VectorTileLayer } from '@mapbox/vector-tile';
export type BinderUniform = {
    name: string;
    property: string;
    binding: Uniform<any>;
};
type PaintOptions = {
    imagePositions: {
        [_: string]: ImagePosition;
    };
    canonical?: CanonicalTileID;
    formattedSection?: FormattedSection;
    globalState?: Record<string, any>;
};
interface AttributeBinder {
    populatePaintArray(length: number, feature: Feature, options: PaintOptions): void;
    updatePaintArray(start: number, length: number, feature: Feature, featureState: FeatureState, options: PaintOptions): void;
    upload(a: Context): void;
    destroy(): void;
}
interface UniformBinder {
    uniformNames: Array<string>;
    setUniform(uniform: Uniform<any>, globals: GlobalProperties, currentValue: PossiblyEvaluatedPropertyValue<any>, uniformName: string): void;
    getBinding(context: Context, location: WebGLUniformLocation, name: string): Partial<Uniform<any>>;
}
export declare class ProgramConfiguration {
    binders: {
        [_: string]: AttributeBinder | UniformBinder;
    };
    cacheKey: string;
    _buffers: Array<VertexBuffer>;
    constructor(layer: TypedStyleLayer, zoom: number, filterProperties: (_: string) => boolean);
    getMaxValue(property: string): number;
    populatePaintArrays(newLength: number, feature: Feature, options: PaintOptions): void;
    setConstantPatternPositions(posTo: ImagePosition, posFrom: ImagePosition): void;
    updatePaintArrays(featureStates: FeatureStates, featureMap: FeaturePositionMap, vtLayer: VectorTileLayer, layer: TypedStyleLayer, options: PaintOptions): boolean;
    defines(): Array<string>;
    getBinderAttributes(): Array<string>;
    getBinderUniforms(): Array<string>;
    getPaintVertexBuffers(): Array<VertexBuffer>;
    getUniforms(context: Context, locations: UniformLocations): Array<BinderUniform>;
    setUniforms(context: Context, binderUniforms: Array<BinderUniform>, properties: any, globals: GlobalProperties): void;
    updatePaintBuffers(crossfade?: CrossfadeParameters): void;
    upload(context: Context): void;
    destroy(): void;
}
export declare class ProgramConfigurationSet<Layer extends TypedStyleLayer> {
    programConfigurations: {
        [_: string]: ProgramConfiguration;
    };
    needsUpload: boolean;
    _featureMap: FeaturePositionMap;
    _bufferOffset: number;
    constructor(layers: ReadonlyArray<Layer>, zoom: number, filterProperties?: (_: string) => boolean);
    populatePaintArrays(length: number, feature: Feature, index: number, options: PaintOptions): void;
    updatePaintArrays(featureStates: FeatureStates, vtLayer: VectorTileLayer, layers: ReadonlyArray<TypedStyleLayer>, options: PaintOptions): void;
    get(layerId: string): ProgramConfiguration;
    upload(context: Context): void;
    destroy(): void;
}
export {};
//# sourceMappingURL=program_configuration.d.ts.map