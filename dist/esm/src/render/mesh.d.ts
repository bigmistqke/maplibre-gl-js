import { type SegmentVector } from '../data/segment';
import { type VertexBuffer } from '../gl/vertex_buffer';
import { type IndexBuffer } from '../gl/index_buffer';
export declare class Mesh {
    vertexBuffer: VertexBuffer;
    indexBuffer: IndexBuffer;
    segments: SegmentVector;
    constructor(vertexBuffer: VertexBuffer, indexBuffer: IndexBuffer, segments: SegmentVector);
    destroy(): void;
}
//# sourceMappingURL=mesh.d.ts.map