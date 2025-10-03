import { transpileVertexShaderToWebGL1, transpileFragmentShaderToWebGL1 } from '../shaders/shaders';
import { getShaders } from '../shaders/shader_registry';
import { VertexArrayObject } from './vertex_array_object';
import { isWebGL2 } from '../gl/webgl2';
import { terrainPreludeUniforms } from './program/terrain_program';
import { projectionObjectToUniformMap, projectionUniforms } from './program/projection_program';
function getTokenizedAttributesAndUniforms(array) {
    const result = [];
    for (let i = 0; i < array.length; i++) {
        if (array[i] === null)
            continue;
        const token = array[i].split(' ');
        result.push(token.pop());
    }
    return result;
}
export class Program {
    constructor(context, source, configuration, fixedUniforms, showOverdrawInspector, hasTerrain, projectionPrelude, projectionDefine, extraDefines = []) {
        var _a;
        const gl = context.gl;
        this.program = gl.createProgram();
        const staticAttrInfo = getTokenizedAttributesAndUniforms(source.staticAttributes);
        const dynamicAttrInfo = configuration ? configuration.getBinderAttributes() : [];
        const allAttrInfo = staticAttrInfo.concat(dynamicAttrInfo);
        const preludeUniformsInfo = ((_a = getShaders().prelude) === null || _a === void 0 ? void 0 : _a.staticUniforms) ? getTokenizedAttributesAndUniforms(getShaders().prelude.staticUniforms) : [];
        const projectionPreludeUniformsInfo = projectionPrelude.staticUniforms ? getTokenizedAttributesAndUniforms(projectionPrelude.staticUniforms) : [];
        const staticUniformsInfo = source.staticUniforms ? getTokenizedAttributesAndUniforms(source.staticUniforms) : [];
        const dynamicUniformsInfo = configuration ? configuration.getBinderUniforms() : [];
        const uniformList = preludeUniformsInfo.concat(projectionPreludeUniformsInfo).concat(staticUniformsInfo).concat(dynamicUniformsInfo);
        const allUniformsInfo = [];
        for (const uniform of uniformList) {
            if (allUniformsInfo.indexOf(uniform) < 0)
                allUniformsInfo.push(uniform);
        }
        const defines = configuration ? configuration.defines() : [];
        if (isWebGL2(gl)) {
            defines.unshift('#version 300 es');
        }
        if (showOverdrawInspector) {
            defines.push('#define OVERDRAW_INSPECTOR;');
        }
        if (hasTerrain) {
            defines.push('#define TERRAIN3D;');
        }
        if (projectionDefine) {
            defines.push(projectionDefine);
        }
        if (extraDefines) {
            defines.push(...extraDefines);
        }
        let fragmentSource = defines.concat(getShaders().prelude.fragmentSource, projectionPrelude.fragmentSource, source.fragmentSource).join('\n');
        let vertexSource = defines.concat(getShaders().prelude.vertexSource, projectionPrelude.vertexSource, source.vertexSource).join('\n');
        if (!isWebGL2(gl)) {
            fragmentSource = transpileFragmentShaderToWebGL1(fragmentSource);
            vertexSource = transpileVertexShaderToWebGL1(vertexSource);
        }
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        if (gl.isContextLost()) {
            this.failedToCreate = true;
            return;
        }
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);
        if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
            throw new Error(`Could not compile fragment shader: ${gl.getShaderInfoLog(fragmentShader)}`);
        }
        gl.attachShader(this.program, fragmentShader);
        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        if (gl.isContextLost()) {
            this.failedToCreate = true;
            return;
        }
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);
        if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
            throw new Error(`Could not compile vertex shader: ${gl.getShaderInfoLog(vertexShader)}`);
        }
        gl.attachShader(this.program, vertexShader);
        this.attributes = {};
        const uniformLocations = {};
        this.numAttributes = allAttrInfo.length;
        for (let i = 0; i < this.numAttributes; i++) {
            if (allAttrInfo[i]) {
                gl.bindAttribLocation(this.program, i, allAttrInfo[i]);
                this.attributes[allAttrInfo[i]] = i;
            }
        }
        gl.linkProgram(this.program);
        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            throw new Error(`Program failed to link: ${gl.getProgramInfoLog(this.program)}`);
        }
        gl.deleteShader(vertexShader);
        gl.deleteShader(fragmentShader);
        for (let it = 0; it < allUniformsInfo.length; it++) {
            const uniform = allUniformsInfo[it];
            if (uniform && !uniformLocations[uniform]) {
                const uniformLocation = gl.getUniformLocation(this.program, uniform);
                if (uniformLocation) {
                    uniformLocations[uniform] = uniformLocation;
                }
            }
        }
        this.fixedUniforms = fixedUniforms(context, uniformLocations);
        this.terrainUniforms = terrainPreludeUniforms(context, uniformLocations);
        this.projectionUniforms = projectionUniforms(context, uniformLocations);
        this.binderUniforms = configuration ? configuration.getUniforms(context, uniformLocations) : [];
    }
    draw(context, drawMode, depthMode, stencilMode, colorMode, cullFaceMode, uniformValues, terrain, projectionData, layerID, layoutVertexBuffer, indexBuffer, segments, currentProperties, zoom, configuration, dynamicLayoutBuffer, dynamicLayoutBuffer2, dynamicLayoutBuffer3) {
        const gl = context.gl;
        if (this.failedToCreate)
            return;
        context.program.set(this.program);
        context.setDepthMode(depthMode);
        context.setStencilMode(stencilMode);
        context.setColorMode(colorMode);
        context.setCullFace(cullFaceMode);
        if (terrain) {
            context.activeTexture.set(gl.TEXTURE2);
            gl.bindTexture(gl.TEXTURE_2D, terrain.depthTexture);
            context.activeTexture.set(gl.TEXTURE3);
            gl.bindTexture(gl.TEXTURE_2D, terrain.texture);
            for (const name in this.terrainUniforms) {
                this.terrainUniforms[name].set(terrain[name]);
            }
        }
        if (projectionData) {
            for (const fieldName in projectionData) {
                const uniformName = projectionObjectToUniformMap[fieldName];
                this.projectionUniforms[uniformName].set(projectionData[fieldName]);
            }
        }
        if (uniformValues) {
            for (const name in this.fixedUniforms) {
                this.fixedUniforms[name].set(uniformValues[name]);
            }
        }
        if (configuration) {
            configuration.setUniforms(context, this.binderUniforms, currentProperties, { zoom: zoom });
        }
        let primitiveSize = 0;
        switch (drawMode) {
            case gl.LINES:
                primitiveSize = 2;
                break;
            case gl.TRIANGLES:
                primitiveSize = 3;
                break;
            case gl.LINE_STRIP:
                primitiveSize = 1;
                break;
        }
        for (const segment of segments.get()) {
            const vaos = segment.vaos || (segment.vaos = {});
            const vao = vaos[layerID] || (vaos[layerID] = new VertexArrayObject());
            vao.bind(context, this, layoutVertexBuffer, configuration ? configuration.getPaintVertexBuffers() : [], indexBuffer, segment.vertexOffset, dynamicLayoutBuffer, dynamicLayoutBuffer2, dynamicLayoutBuffer3);
            gl.drawElements(drawMode, segment.primitiveLength * primitiveSize, gl.UNSIGNED_SHORT, segment.primitiveOffset * primitiveSize * 2);
        }
    }
}
//# sourceMappingURL=program.js.map