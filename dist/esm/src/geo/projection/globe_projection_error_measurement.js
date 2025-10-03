import { Color } from '@maplibre/maplibre-gl-style-spec';
import { ColorMode } from '../../gl/color_mode';
import { CullFaceMode } from '../../gl/cull_face_mode';
import { DepthMode } from '../../gl/depth_mode';
import { StencilMode } from '../../gl/stencil_mode';
import { warnOnce } from '../../util/util';
import { projectionErrorMeasurementUniformValues } from '../../render/program/projection_error_measurement_program';
import { Mesh } from '../../render/mesh';
import { SegmentVector } from '../../data/segment';
import { PosArray, TriangleIndexArray } from '../../data/array_types.g';
import posAttributes from '../../data/pos_attributes';
import { isWebGL2 } from '../../gl/webgl2';
export class ProjectionErrorMeasurement {
    get awaitingQuery() {
        return !!this._readbackQueue;
    }
    constructor(renderContext) {
        this._readbackWaitFrames = 4;
        this._measureWaitFrames = 6;
        this._texWidth = 1;
        this._texHeight = 1;
        this._measuredError = 0;
        this._updateCount = 0;
        this._lastReadbackFrame = -1000;
        this._readbackQueue = null;
        this._cachedRenderContext = renderContext;
        const context = renderContext.context;
        const gl = context.gl;
        this._texFormat = gl.RGBA;
        this._texType = gl.UNSIGNED_BYTE;
        const vertexArray = new PosArray();
        vertexArray.emplaceBack(-1, -1);
        vertexArray.emplaceBack(2, -1);
        vertexArray.emplaceBack(-1, 2);
        const indexArray = new TriangleIndexArray();
        indexArray.emplaceBack(0, 1, 2);
        this._fullscreenTriangle = new Mesh(context.createVertexBuffer(vertexArray, posAttributes.members), context.createIndexBuffer(indexArray), SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length));
        this._resultBuffer = new Uint8Array(4);
        context.activeTexture.set(gl.TEXTURE1);
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
        gl.texImage2D(gl.TEXTURE_2D, 0, this._texFormat, this._texWidth, this._texHeight, 0, this._texFormat, this._texType, null);
        this._fbo = context.createFramebuffer(this._texWidth, this._texHeight, false, false);
        this._fbo.colorAttachment.set(texture);
        if (isWebGL2(gl)) {
            this._pbo = gl.createBuffer();
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this._pbo);
            gl.bufferData(gl.PIXEL_PACK_BUFFER, 4, gl.STREAM_READ);
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        }
    }
    destroy() {
        const gl = this._cachedRenderContext.context.gl;
        this._fullscreenTriangle.destroy();
        this._fbo.destroy();
        gl.deleteBuffer(this._pbo);
        this._fullscreenTriangle = null;
        this._fbo = null;
        this._pbo = null;
        this._resultBuffer = null;
    }
    updateErrorLoop(normalizedMercatorY, expectedAngleY) {
        const currentFrame = this._updateCount;
        if (this._readbackQueue) {
            if (currentFrame >= this._readbackQueue.frameNumberIssued + this._readbackWaitFrames) {
                this._tryReadback();
            }
        }
        else {
            if (currentFrame >= this._lastReadbackFrame + this._measureWaitFrames) {
                this._renderErrorTexture(normalizedMercatorY, expectedAngleY);
            }
        }
        this._updateCount++;
        return this._measuredError;
    }
    _bindFramebuffer() {
        const context = this._cachedRenderContext.context;
        const gl = context.gl;
        context.activeTexture.set(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this._fbo.colorAttachment.get());
        context.bindFramebuffer.set(this._fbo.framebuffer);
    }
    _renderErrorTexture(input, outputExpected) {
        const context = this._cachedRenderContext.context;
        const gl = context.gl;
        this._bindFramebuffer();
        context.viewport.set([0, 0, this._texWidth, this._texHeight]);
        context.clear({ color: Color.transparent });
        const program = this._cachedRenderContext.useProgram('projectionErrorMeasurement');
        program.draw(context, gl.TRIANGLES, DepthMode.disabled, StencilMode.disabled, ColorMode.unblended, CullFaceMode.disabled, projectionErrorMeasurementUniformValues(input, outputExpected), null, null, '$clipping', this._fullscreenTriangle.vertexBuffer, this._fullscreenTriangle.indexBuffer, this._fullscreenTriangle.segments);
        if (this._pbo && isWebGL2(gl)) {
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this._pbo);
            gl.readBuffer(gl.COLOR_ATTACHMENT0);
            gl.readPixels(0, 0, this._texWidth, this._texHeight, this._texFormat, this._texType, 0);
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
            const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
            gl.flush();
            this._readbackQueue = {
                frameNumberIssued: this._updateCount,
                sync,
            };
        }
        else {
            this._readbackQueue = {
                frameNumberIssued: this._updateCount,
                sync: null,
            };
        }
    }
    _tryReadback() {
        const gl = this._cachedRenderContext.context.gl;
        if (this._pbo && this._readbackQueue && isWebGL2(gl)) {
            const waitResult = gl.clientWaitSync(this._readbackQueue.sync, 0, 0);
            if (waitResult === gl.WAIT_FAILED) {
                warnOnce('WebGL2 clientWaitSync failed.');
                this._readbackQueue = null;
                this._lastReadbackFrame = this._updateCount;
                return;
            }
            if (waitResult === gl.TIMEOUT_EXPIRED) {
                return;
            }
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this._pbo);
            gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this._resultBuffer, 0, 4);
            gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
        }
        else {
            this._bindFramebuffer();
            gl.readPixels(0, 0, this._texWidth, this._texHeight, this._texFormat, this._texType, this._resultBuffer);
        }
        this._readbackQueue = null;
        this._measuredError = ProjectionErrorMeasurement._parseRGBA8float(this._resultBuffer);
        this._lastReadbackFrame = this._updateCount;
    }
    static _parseRGBA8float(buffer) {
        let result = 0;
        result += buffer[0] / 256.0;
        result += buffer[1] / 65536.0;
        result += buffer[2] / 16777216.0;
        if (buffer[3] < 127.0) {
            result = -result;
        }
        return result / 128.0;
    }
}
//# sourceMappingURL=globe_projection_error_measurement.js.map