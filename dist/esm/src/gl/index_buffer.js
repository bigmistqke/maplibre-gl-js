export class IndexBuffer {
    constructor(context, array, dynamicDraw) {
        this.context = context;
        const gl = context.gl;
        this.buffer = gl.createBuffer();
        this.dynamicDraw = Boolean(dynamicDraw);
        this.context.unbindVAO();
        context.bindElementBuffer.set(this.buffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, array.arrayBuffer, this.dynamicDraw ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
        if (!this.dynamicDraw) {
            delete array.arrayBuffer;
        }
    }
    bind() {
        this.context.bindElementBuffer.set(this.buffer);
    }
    updateData(array) {
        const gl = this.context.gl;
        if (!this.dynamicDraw)
            throw new Error('Attempted to update data while not in dynamic mode.');
        this.context.unbindVAO();
        this.bind();
        gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, array.arrayBuffer);
    }
    destroy() {
        const gl = this.context.gl;
        if (this.buffer) {
            gl.deleteBuffer(this.buffer);
            delete this.buffer;
        }
    }
}
//# sourceMappingURL=index_buffer.js.map