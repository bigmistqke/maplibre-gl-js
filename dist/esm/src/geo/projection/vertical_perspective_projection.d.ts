import type { Context } from '../../gl/context';
import type { CanonicalTileID } from '../../source/tile_id';
import { type Mesh } from '../../render/mesh';
import { SubdivisionGranularitySetting } from '../../render/subdivision_granularity_settings';
import type { Projection, ProjectionGPUContext, TileMeshUsage } from './projection';
import { type PreparedShader } from '../../shaders/shaders';
import { type EvaluationParameters } from '../../style/evaluation_parameters';
export declare const VerticalPerspectiveShaderDefine = "#define GLOBE";
export declare const VerticalPerspectiveShaderVariantKey = "globe";
export declare const globeConstants: {
    errorTransitionTimeSeconds: number;
};
export declare class VerticalPerspectiveProjection implements Projection {
    private _tileMeshCache;
    private _errorMeasurement;
    private _errorQueryLatitudeDegrees;
    private _errorCorrectionUsable;
    private _errorMeasurementLastValue;
    private _errorCorrectionPreviousValue;
    private _errorMeasurementLastChangeTime;
    get name(): 'vertical-perspective';
    get transitionState(): number;
    get useSubdivision(): boolean;
    get shaderVariantName(): string;
    get shaderDefine(): string;
    get shaderPreludeCode(): PreparedShader;
    get vertexShaderPreludeCode(): string;
    get subdivisionGranularity(): SubdivisionGranularitySetting;
    get useGlobeControls(): boolean;
    get latitudeErrorCorrectionRadians(): number;
    destroy(): void;
    updateGPUdependent(renderContext: ProjectionGPUContext): void;
    private _getMeshKey;
    getMeshFromTileID(context: Context, canonical: CanonicalTileID, hasBorder: boolean, allowPoles: boolean, usage: TileMeshUsage): Mesh;
    private _getMesh;
    recalculate(_params: EvaluationParameters): void;
    hasTransition(): boolean;
    setErrorQueryLatitudeDegrees(value: number): void;
}
//# sourceMappingURL=vertical_perspective_projection.d.ts.map