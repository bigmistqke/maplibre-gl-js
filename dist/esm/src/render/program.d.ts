import { type PreparedShader } from '../shaders/shaders';
import { type ProgramConfiguration } from '../data/program_configuration';
import { type Context } from '../gl/context';
import type { SegmentVector } from '../data/segment';
import type { VertexBuffer } from '../gl/vertex_buffer';
import type { IndexBuffer } from '../gl/index_buffer';
import type { DepthMode } from '../gl/depth_mode';
import type { StencilMode } from '../gl/stencil_mode';
import type { ColorMode } from '../gl/color_mode';
import type { CullFaceMode } from '../gl/cull_face_mode';
import type { UniformBindings, UniformValues, UniformLocations } from './uniform_binding';
import type { BinderUniform } from '../data/program_configuration';
import { type TerrainPreludeUniformsType } from './program/terrain_program';
import type { TerrainData } from '../render/terrain';
import { type ProjectionPreludeUniformsType } from './program/projection_program';
import type { ProjectionData } from '../geo/projection/projection_data';
export type DrawMode = WebGLRenderingContextBase['LINES'] | WebGLRenderingContextBase['TRIANGLES'] | WebGL2RenderingContext['LINE_STRIP'];
export declare class Program<Us extends UniformBindings> {
    program: WebGLProgram;
    attributes: {
        [_: string]: number;
    };
    numAttributes: number;
    fixedUniforms: Us;
    terrainUniforms: TerrainPreludeUniformsType;
    projectionUniforms: ProjectionPreludeUniformsType;
    binderUniforms: Array<BinderUniform>;
    failedToCreate: boolean;
    constructor(context: Context, source: PreparedShader, configuration: ProgramConfiguration, fixedUniforms: (b: Context, a: UniformLocations) => Us, showOverdrawInspector: boolean, hasTerrain: boolean, projectionPrelude: PreparedShader, projectionDefine: string, extraDefines?: Array<string>);
    draw(context: Context, drawMode: DrawMode, depthMode: Readonly<DepthMode>, stencilMode: Readonly<StencilMode>, colorMode: Readonly<ColorMode>, cullFaceMode: Readonly<CullFaceMode>, uniformValues: UniformValues<Us>, terrain: TerrainData, projectionData: ProjectionData, layerID: string, layoutVertexBuffer: VertexBuffer, indexBuffer: IndexBuffer, segments: SegmentVector, currentProperties?: any, zoom?: number | null, configuration?: ProgramConfiguration | null, dynamicLayoutBuffer?: VertexBuffer | null, dynamicLayoutBuffer2?: VertexBuffer | null, dynamicLayoutBuffer3?: VertexBuffer | null): void;
}
//# sourceMappingURL=program.d.ts.map