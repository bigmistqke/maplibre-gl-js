import type { Projection, ProjectionGPUContext, TileMeshUsage } from './projection';
import type { CanonicalTileID } from '../../source/tile_id';
import { type PreparedShader } from '../../shaders/shaders';
import type { Context } from '../../gl/context';
import { Mesh } from '../../render/mesh';
import { SubdivisionGranularitySetting } from '../../render/subdivision_granularity_settings';
export declare const MercatorShaderDefine = "#define PROJECTION_MERCATOR";
export declare const MercatorShaderVariantKey = "mercator";
export declare class MercatorProjection implements Projection {
    private _cachedMesh;
    get name(): 'mercator';
    get useSubdivision(): boolean;
    get shaderVariantName(): string;
    get shaderDefine(): string;
    get shaderPreludeCode(): PreparedShader;
    get vertexShaderPreludeCode(): string;
    get subdivisionGranularity(): SubdivisionGranularitySetting;
    get useGlobeControls(): boolean;
    get transitionState(): number;
    get latitudeErrorCorrectionRadians(): number;
    destroy(): void;
    updateGPUdependent(_: ProjectionGPUContext): void;
    getMeshFromTileID(context: Context, _tileID: CanonicalTileID, _hasBorder: boolean, _allowPoles: boolean, _usage: TileMeshUsage): Mesh;
    recalculate(): void;
    hasTransition(): boolean;
    setErrorQueryLatitudeDegrees(_value: number): void;
}
//# sourceMappingURL=mercator_projection.d.ts.map