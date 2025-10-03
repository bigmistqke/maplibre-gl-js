import { ProjectionDefinition, type ProjectionDefinitionSpecification, type ProjectionSpecification } from '@maplibre/maplibre-gl-style-spec';
import { DataConstantProperty, type PossiblyEvaluated, Transitionable, type Transitioning, type TransitionParameters } from '../../style/properties';
import { Evented } from '../../util/evented';
import { EvaluationParameters } from '../../style/evaluation_parameters';
import { MercatorProjection } from './mercator_projection';
import { VerticalPerspectiveProjection } from './vertical_perspective_projection';
import { type Projection, type ProjectionGPUContext, type TileMeshUsage } from './projection';
import { type PreparedShader } from '../../shaders/shaders';
import { type SubdivisionGranularitySetting } from '../../render/subdivision_granularity_settings';
import { type Context } from '../../gl/context';
import { type CanonicalTileID } from '../../source/tile_id';
import { type Mesh } from '../../render/mesh';
type ProjectionProps = {
    type: DataConstantProperty<ProjectionDefinition>;
};
type ProjectionPossiblyEvaluated = {
    type: ProjectionDefinitionSpecification;
};
export declare class GlobeProjection extends Evented implements Projection {
    properties: PossiblyEvaluated<ProjectionProps, ProjectionPossiblyEvaluated>;
    _transitionable: Transitionable<ProjectionProps>;
    _transitioning: Transitioning<ProjectionProps>;
    _mercatorProjection: MercatorProjection;
    _verticalPerspectiveProjection: VerticalPerspectiveProjection;
    constructor(projection?: ProjectionSpecification);
    get transitionState(): number;
    get useGlobeRendering(): boolean;
    get latitudeErrorCorrectionRadians(): number;
    private get currentProjection();
    get name(): ProjectionSpecification['type'];
    get useSubdivision(): boolean;
    get shaderVariantName(): string;
    get shaderDefine(): string;
    get shaderPreludeCode(): PreparedShader;
    get vertexShaderPreludeCode(): string;
    get subdivisionGranularity(): SubdivisionGranularitySetting;
    get useGlobeControls(): boolean;
    destroy(): void;
    updateGPUdependent(context: ProjectionGPUContext): void;
    getMeshFromTileID(context: Context, _tileID: CanonicalTileID, _hasBorder: boolean, _allowPoles: boolean, _usage: TileMeshUsage): Mesh;
    setProjection(projection?: ProjectionSpecification): void;
    updateTransitions(parameters: TransitionParameters): void;
    hasTransition(): boolean;
    recalculate(parameters: EvaluationParameters): void;
    setErrorQueryLatitudeDegrees(value: number): void;
}
export {};
//# sourceMappingURL=globe_projection.d.ts.map