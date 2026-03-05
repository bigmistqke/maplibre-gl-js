import {type SegmentVector} from '../data/segment';
import {type VertexBuffer} from '../gl/vertex_buffer';
import {type IndexBuffer} from '../gl/index_buffer';
import {assertedNotNullish} from '../util/util';

export class Mesh {
    vertexBuffer: VertexBuffer | null;
    indexBuffer: IndexBuffer | null;
    segments: SegmentVector | null;

    constructor(vertexBuffer: VertexBuffer, indexBuffer: IndexBuffer, segments: SegmentVector) {
        this.vertexBuffer = vertexBuffer;
        this.indexBuffer = indexBuffer;
        this.segments = segments;
    }

    destroy(): void {
        assertedNotNullish(this.vertexBuffer).destroy();
        assertedNotNullish(this.indexBuffer).destroy();
        assertedNotNullish(this.segments).destroy();

        this.vertexBuffer = null;
        this.indexBuffer = null;
        this.segments = null;
    }
}
