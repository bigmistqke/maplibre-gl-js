import type { CanonicalTileID } from '../../source/tile_id';
import type { PreparedShader } from '../../shaders/shaders';
import type { Context } from '../../gl/context';
import type { Mesh } from '../../render/mesh';
import type { Program } from '../../render/program';
import type { SubdivisionGranularitySetting } from '../../render/subdivision_granularity_settings';
import type { ProjectionSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { EvaluationParameters } from '../../style/evaluation_parameters';
export type ProjectionGPUContext = {
    context: Context;
    useProgram: (name: string) => Program<any>;
};
export type TileMeshUsage = 'stencil' | 'raster';
export interface Projection {
    get name(): ProjectionSpecification['type'];
    get useSubdivision(): boolean;
    get shaderVariantName(): string;
    get shaderDefine(): string;
    get shaderPreludeCode(): PreparedShader;
    get vertexShaderPreludeCode(): string;
    get subdivisionGranularity(): SubdivisionGranularitySetting;
    get transitionState(): number;
    get latitudeErrorCorrectionRadians(): number;
    destroy(): void;
    updateGPUdependent(renderContext: ProjectionGPUContext): void;
    getMeshFromTileID(context: Context, tileID: CanonicalTileID, hasBorder: boolean, allowPoles: boolean, usage: TileMeshUsage): Mesh;
    recalculate(params: EvaluationParameters): void;
    hasTransition(): boolean;
    setErrorQueryLatitudeDegrees(value: number): any;
}
//# sourceMappingURL=projection.d.ts.map