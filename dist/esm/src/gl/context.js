import { IndexBuffer } from './index_buffer';
import { VertexBuffer } from './vertex_buffer';
import { Framebuffer } from './framebuffer';
import { ColorMode } from './color_mode';
import { deepEqual } from '../util/util';
import { ClearColor, ClearDepth, ClearStencil, ColorMask, DepthMask, StencilMask, StencilFunc, StencilOp, StencilTest, DepthRange, DepthTest, DepthFunc, Blend, BlendFunc, BlendColor, BlendEquation, CullFace, CullFaceSide, FrontFace, ProgramValue, ActiveTextureUnit, Viewport, BindFramebuffer, BindRenderbuffer, BindTexture, BindVertexBuffer, BindElementBuffer, BindVertexArray, PixelStoreUnpack, PixelStoreUnpackPremultiplyAlpha, PixelStoreUnpackFlipY } from './value';
import { isWebGL2 } from './webgl2';
export class Context {
    constructor(gl) {
        var _a, _b;
        this.gl = gl;
        this.clearColor = new ClearColor(this);
        this.clearDepth = new ClearDepth(this);
        this.clearStencil = new ClearStencil(this);
        this.colorMask = new ColorMask(this);
        this.depthMask = new DepthMask(this);
        this.stencilMask = new StencilMask(this);
        this.stencilFunc = new StencilFunc(this);
        this.stencilOp = new StencilOp(this);
        this.stencilTest = new StencilTest(this);
        this.depthRange = new DepthRange(this);
        this.depthTest = new DepthTest(this);
        this.depthFunc = new DepthFunc(this);
        this.blend = new Blend(this);
        this.blendFunc = new BlendFunc(this);
        this.blendColor = new BlendColor(this);
        this.blendEquation = new BlendEquation(this);
        this.cullFace = new CullFace(this);
        this.cullFaceSide = new CullFaceSide(this);
        this.frontFace = new FrontFace(this);
        this.program = new ProgramValue(this);
        this.activeTexture = new ActiveTextureUnit(this);
        this.viewport = new Viewport(this);
        this.bindFramebuffer = new BindFramebuffer(this);
        this.bindRenderbuffer = new BindRenderbuffer(this);
        this.bindTexture = new BindTexture(this);
        this.bindVertexBuffer = new BindVertexBuffer(this);
        this.bindElementBuffer = new BindElementBuffer(this);
        this.bindVertexArray = new BindVertexArray(this);
        this.pixelStoreUnpack = new PixelStoreUnpack(this);
        this.pixelStoreUnpackPremultiplyAlpha = new PixelStoreUnpackPremultiplyAlpha(this);
        this.pixelStoreUnpackFlipY = new PixelStoreUnpackFlipY(this);
        this.extTextureFilterAnisotropic = (gl.getExtension('EXT_texture_filter_anisotropic') ||
            gl.getExtension('MOZ_EXT_texture_filter_anisotropic') ||
            gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic'));
        if (this.extTextureFilterAnisotropic) {
            this.extTextureFilterAnisotropicMax = gl.getParameter(this.extTextureFilterAnisotropic.MAX_TEXTURE_MAX_ANISOTROPY_EXT);
        }
        this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        if (isWebGL2(gl)) {
            this.HALF_FLOAT = gl.HALF_FLOAT;
            const extColorBufferHalfFloat = gl.getExtension('EXT_color_buffer_half_float');
            this.RGBA16F = (_a = gl.RGBA16F) !== null && _a !== void 0 ? _a : extColorBufferHalfFloat === null || extColorBufferHalfFloat === void 0 ? void 0 : extColorBufferHalfFloat.RGBA16F_EXT;
            this.RGB16F = (_b = gl.RGB16F) !== null && _b !== void 0 ? _b : extColorBufferHalfFloat === null || extColorBufferHalfFloat === void 0 ? void 0 : extColorBufferHalfFloat.RGB16F_EXT;
            gl.getExtension('EXT_color_buffer_float');
        }
        else {
            gl.getExtension('EXT_color_buffer_half_float');
            gl.getExtension('OES_texture_half_float_linear');
            const extTextureHalfFloat = gl.getExtension('OES_texture_half_float');
            this.HALF_FLOAT = extTextureHalfFloat === null || extTextureHalfFloat === void 0 ? void 0 : extTextureHalfFloat.HALF_FLOAT_OES;
        }
    }
    setDefault() {
        this.unbindVAO();
        this.clearColor.setDefault();
        this.clearDepth.setDefault();
        this.clearStencil.setDefault();
        this.colorMask.setDefault();
        this.depthMask.setDefault();
        this.stencilMask.setDefault();
        this.stencilFunc.setDefault();
        this.stencilOp.setDefault();
        this.stencilTest.setDefault();
        this.depthRange.setDefault();
        this.depthTest.setDefault();
        this.depthFunc.setDefault();
        this.blend.setDefault();
        this.blendFunc.setDefault();
        this.blendColor.setDefault();
        this.blendEquation.setDefault();
        this.cullFace.setDefault();
        this.cullFaceSide.setDefault();
        this.frontFace.setDefault();
        this.program.setDefault();
        this.activeTexture.setDefault();
        this.bindFramebuffer.setDefault();
        this.pixelStoreUnpack.setDefault();
        this.pixelStoreUnpackPremultiplyAlpha.setDefault();
        this.pixelStoreUnpackFlipY.setDefault();
    }
    setDirty() {
        this.clearColor.dirty = true;
        this.clearDepth.dirty = true;
        this.clearStencil.dirty = true;
        this.colorMask.dirty = true;
        this.depthMask.dirty = true;
        this.stencilMask.dirty = true;
        this.stencilFunc.dirty = true;
        this.stencilOp.dirty = true;
        this.stencilTest.dirty = true;
        this.depthRange.dirty = true;
        this.depthTest.dirty = true;
        this.depthFunc.dirty = true;
        this.blend.dirty = true;
        this.blendFunc.dirty = true;
        this.blendColor.dirty = true;
        this.blendEquation.dirty = true;
        this.cullFace.dirty = true;
        this.cullFaceSide.dirty = true;
        this.frontFace.dirty = true;
        this.program.dirty = true;
        this.activeTexture.dirty = true;
        this.viewport.dirty = true;
        this.bindFramebuffer.dirty = true;
        this.bindRenderbuffer.dirty = true;
        this.bindTexture.dirty = true;
        this.bindVertexBuffer.dirty = true;
        this.bindElementBuffer.dirty = true;
        this.bindVertexArray.dirty = true;
        this.pixelStoreUnpack.dirty = true;
        this.pixelStoreUnpackPremultiplyAlpha.dirty = true;
        this.pixelStoreUnpackFlipY.dirty = true;
    }
    createIndexBuffer(array, dynamicDraw) {
        return new IndexBuffer(this, array, dynamicDraw);
    }
    createVertexBuffer(array, attributes, dynamicDraw) {
        return new VertexBuffer(this, array, attributes, dynamicDraw);
    }
    createRenderbuffer(storageFormat, width, height) {
        const gl = this.gl;
        const rbo = gl.createRenderbuffer();
        this.bindRenderbuffer.set(rbo);
        gl.renderbufferStorage(gl.RENDERBUFFER, storageFormat, width, height);
        this.bindRenderbuffer.set(null);
        return rbo;
    }
    createFramebuffer(width, height, hasDepth, hasStencil) {
        return new Framebuffer(this, width, height, hasDepth, hasStencil);
    }
    clear({ color, depth, stencil }) {
        const gl = this.gl;
        let mask = 0;
        if (color) {
            mask |= gl.COLOR_BUFFER_BIT;
            this.clearColor.set(color);
            this.colorMask.set([true, true, true, true]);
        }
        if (typeof depth !== 'undefined') {
            mask |= gl.DEPTH_BUFFER_BIT;
            this.depthRange.set([0, 1]);
            this.clearDepth.set(depth);
            this.depthMask.set(true);
        }
        if (typeof stencil !== 'undefined') {
            mask |= gl.STENCIL_BUFFER_BIT;
            this.clearStencil.set(stencil);
            this.stencilMask.set(0xFF);
        }
        gl.clear(mask);
    }
    setCullFace(cullFaceMode) {
        if (cullFaceMode.enable === false) {
            this.cullFace.set(false);
        }
        else {
            this.cullFace.set(true);
            this.cullFaceSide.set(cullFaceMode.mode);
            this.frontFace.set(cullFaceMode.frontFace);
        }
    }
    setDepthMode(depthMode) {
        if (depthMode.func === this.gl.ALWAYS && !depthMode.mask) {
            this.depthTest.set(false);
        }
        else {
            this.depthTest.set(true);
            this.depthFunc.set(depthMode.func);
            this.depthMask.set(depthMode.mask);
            this.depthRange.set(depthMode.range);
        }
    }
    setStencilMode(stencilMode) {
        if (stencilMode.test.func === this.gl.ALWAYS && !stencilMode.mask) {
            this.stencilTest.set(false);
        }
        else {
            this.stencilTest.set(true);
            this.stencilMask.set(stencilMode.mask);
            this.stencilOp.set([stencilMode.fail, stencilMode.depthFail, stencilMode.pass]);
            this.stencilFunc.set({
                func: stencilMode.test.func,
                ref: stencilMode.ref,
                mask: stencilMode.test.mask
            });
        }
    }
    setColorMode(colorMode) {
        if (deepEqual(colorMode.blendFunction, ColorMode.Replace)) {
            this.blend.set(false);
        }
        else {
            this.blend.set(true);
            this.blendFunc.set(colorMode.blendFunction);
            this.blendColor.set(colorMode.blendColor);
        }
        this.colorMask.set(colorMode.mask);
    }
    createVertexArray() {
        var _a;
        if (isWebGL2(this.gl))
            return this.gl.createVertexArray();
        return (_a = this.gl.getExtension('OES_vertex_array_object')) === null || _a === void 0 ? void 0 : _a.createVertexArrayOES();
    }
    deleteVertexArray(x) {
        var _a;
        if (isWebGL2(this.gl))
            return this.gl.deleteVertexArray(x);
        return (_a = this.gl.getExtension('OES_vertex_array_object')) === null || _a === void 0 ? void 0 : _a.deleteVertexArrayOES(x);
    }
    unbindVAO() {
        this.bindVertexArray.set(null);
    }
}
//# sourceMappingURL=context.js.map