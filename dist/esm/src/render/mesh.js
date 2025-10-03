export class Mesh {
    constructor(vertexBuffer, indexBuffer, segments) {
        this.vertexBuffer = vertexBuffer;
        this.indexBuffer = indexBuffer;
        this.segments = segments;
    }
    destroy() {
        this.vertexBuffer.destroy();
        this.indexBuffer.destroy();
        this.segments.destroy();
        this.vertexBuffer = null;
        this.indexBuffer = null;
        this.segments = null;
    }
}
//# sourceMappingURL=mesh.js.map