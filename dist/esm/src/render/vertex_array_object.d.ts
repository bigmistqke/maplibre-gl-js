import type { Program } from './program';
import type { VertexBuffer } from '../gl/vertex_buffer';
import type { IndexBuffer } from '../gl/index_buffer';
import type { Context } from '../gl/context';
export declare class VertexArrayObject {
    context: Context;
    boundProgram: Program<any>;
    boundLayoutVertexBuffer: VertexBuffer;
    boundPaintVertexBuffers: Array<VertexBuffer>;
    boundIndexBuffer: IndexBuffer;
    boundVertexOffset: number;
    boundDynamicVertexBuffer: VertexBuffer;
    boundDynamicVertexBuffer2: VertexBuffer;
    boundDynamicVertexBuffer3: VertexBuffer;
    vao: any;
    constructor();
    bind(context: Context, program: Program<any>, layoutVertexBuffer: VertexBuffer, paintVertexBuffers: Array<VertexBuffer>, indexBuffer?: IndexBuffer | null, vertexOffset?: number | null, dynamicVertexBuffer?: VertexBuffer | null, dynamicVertexBuffer2?: VertexBuffer | null, dynamicVertexBuffer3?: VertexBuffer | null): void;
    freshBind(program: Program<any>, layoutVertexBuffer: VertexBuffer, paintVertexBuffers: Array<VertexBuffer>, indexBuffer?: IndexBuffer | null, vertexOffset?: number | null, dynamicVertexBuffer?: VertexBuffer | null, dynamicVertexBuffer2?: VertexBuffer | null, dynamicVertexBuffer3?: VertexBuffer | null): void;
    destroy(): void;
}
//# sourceMappingURL=vertex_array_object.d.ts.map