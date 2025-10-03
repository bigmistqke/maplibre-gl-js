import type { StructArray, StructArrayMember } from '../util/struct_array';
import type { Program } from '../render/program';
import type { Context } from '../gl/context';
export declare class VertexBuffer {
    length: number;
    attributes: ReadonlyArray<StructArrayMember>;
    itemSize: number;
    dynamicDraw: boolean;
    context: Context;
    buffer: WebGLBuffer;
    constructor(context: Context, array: StructArray, attributes: ReadonlyArray<StructArrayMember>, dynamicDraw?: boolean);
    bind(): void;
    updateData(array: StructArray): void;
    enableAttributes(gl: WebGLRenderingContext | WebGL2RenderingContext, program: Program<any>): void;
    setVertexAttribPointers(gl: WebGLRenderingContext | WebGL2RenderingContext, program: Program<any>, vertexOffset?: number | null): void;
    destroy(): void;
}
//# sourceMappingURL=vertex_buffer.d.ts.map