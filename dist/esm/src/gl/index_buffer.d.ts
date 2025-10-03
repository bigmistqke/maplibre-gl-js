import type { StructArray } from '../util/struct_array';
import type { TriangleIndexArray, LineIndexArray, LineStripIndexArray } from '../data/index_array_type';
import type { Context } from '../gl/context';
export declare class IndexBuffer {
    context: Context;
    buffer: WebGLBuffer;
    dynamicDraw: boolean;
    constructor(context: Context, array: TriangleIndexArray | LineIndexArray | LineStripIndexArray, dynamicDraw?: boolean);
    bind(): void;
    updateData(array: StructArray): void;
    destroy(): void;
}
//# sourceMappingURL=index_buffer.d.ts.map