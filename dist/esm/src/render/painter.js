import { browser } from '../util/browser';
import { mat4 } from 'gl-matrix';
import { SourceCache } from '../source/source_cache';
import { EXTENT } from '../data/extent';
import { SegmentVector } from '../data/segment';
import { RasterBoundsArray, PosArray, TriangleIndexArray, LineStripIndexArray } from '../data/array_types.g';
import rasterBoundsAttributes from '../data/raster_bounds_attributes';
import posAttributes from '../data/pos_attributes';
import { createCrossTileSymbolIndex } from '../symbol/symbol_registry';
import { getShaders } from '../shaders/shader_registry';
import { Program } from './program';
import { programUniforms } from './program/program_uniforms';
import { Context } from '../gl/context';
import { DepthMode } from '../gl/depth_mode';
import { StencilMode } from '../gl/stencil_mode';
import { ColorMode } from '../gl/color_mode';
import { CullFaceMode } from '../gl/cull_face_mode';
import { Texture } from './texture';
import { Color } from '@maplibre/maplibre-gl-style-spec';
import { getDrawFunction } from './draw_registry';
import { drawDebug, drawDebugPadding, selectDebugSource } from './draw_debug';
import { drawCustom } from './draw_custom';
import { drawDepth, drawCoords } from './draw_terrain';
import { drawSky, drawAtmosphere } from './draw_sky';
import { Mesh } from './mesh';
import { MercatorShaderDefine, MercatorShaderVariantKey } from '../geo/projection/mercator_projection';
import { coveringTiles } from '../geo/projection/covering_tiles';
import { isCustomStyleLayer } from '../style/style_layer/custom_style_layer';
export class Painter {
    constructor(gl, transform) {
        this.context = new Context(gl);
        this.transform = transform;
        this._tileTextures = {};
        this.terrainFacilitator = { dirty: true, matrix: mat4.identity(new Float64Array(16)), renderTime: 0 };
        this.setup();
        this.numSublayers = SourceCache.maxUnderzooming + SourceCache.maxOverzooming + 1;
        this.depthEpsilon = 1 / Math.pow(2, 16);
        this.crossTileSymbolIndex = createCrossTileSymbolIndex();
    }
    resize(width, height, pixelRatio) {
        this.width = Math.floor(width * pixelRatio);
        this.height = Math.floor(height * pixelRatio);
        this.pixelRatio = pixelRatio;
        this.context.viewport.set([0, 0, this.width, this.height]);
        if (this.style) {
            for (const layerId of this.style._order) {
                this.style._layers[layerId].resize();
            }
        }
    }
    setup() {
        const context = this.context;
        const tileExtentArray = new PosArray();
        tileExtentArray.emplaceBack(0, 0);
        tileExtentArray.emplaceBack(EXTENT, 0);
        tileExtentArray.emplaceBack(0, EXTENT);
        tileExtentArray.emplaceBack(EXTENT, EXTENT);
        this.tileExtentBuffer = context.createVertexBuffer(tileExtentArray, posAttributes.members);
        this.tileExtentSegments = SegmentVector.simpleSegment(0, 0, 4, 2);
        const debugArray = new PosArray();
        debugArray.emplaceBack(0, 0);
        debugArray.emplaceBack(EXTENT, 0);
        debugArray.emplaceBack(0, EXTENT);
        debugArray.emplaceBack(EXTENT, EXTENT);
        this.debugBuffer = context.createVertexBuffer(debugArray, posAttributes.members);
        this.debugSegments = SegmentVector.simpleSegment(0, 0, 4, 5);
        const rasterBoundsArray = new RasterBoundsArray();
        rasterBoundsArray.emplaceBack(0, 0, 0, 0);
        rasterBoundsArray.emplaceBack(EXTENT, 0, EXTENT, 0);
        rasterBoundsArray.emplaceBack(0, EXTENT, 0, EXTENT);
        rasterBoundsArray.emplaceBack(EXTENT, EXTENT, EXTENT, EXTENT);
        this.rasterBoundsBuffer = context.createVertexBuffer(rasterBoundsArray, rasterBoundsAttributes.members);
        this.rasterBoundsSegments = SegmentVector.simpleSegment(0, 0, 4, 2);
        const rasterBoundsArrayPosOnly = new PosArray();
        rasterBoundsArrayPosOnly.emplaceBack(0, 0);
        rasterBoundsArrayPosOnly.emplaceBack(EXTENT, 0);
        rasterBoundsArrayPosOnly.emplaceBack(0, EXTENT);
        rasterBoundsArrayPosOnly.emplaceBack(EXTENT, EXTENT);
        this.rasterBoundsBufferPosOnly = context.createVertexBuffer(rasterBoundsArrayPosOnly, posAttributes.members);
        this.rasterBoundsSegmentsPosOnly = SegmentVector.simpleSegment(0, 0, 4, 5);
        const viewportArray = new PosArray();
        viewportArray.emplaceBack(0, 0);
        viewportArray.emplaceBack(1, 0);
        viewportArray.emplaceBack(0, 1);
        viewportArray.emplaceBack(1, 1);
        this.viewportBuffer = context.createVertexBuffer(viewportArray, posAttributes.members);
        this.viewportSegments = SegmentVector.simpleSegment(0, 0, 4, 2);
        const tileLineStripIndices = new LineStripIndexArray();
        tileLineStripIndices.emplaceBack(0);
        tileLineStripIndices.emplaceBack(1);
        tileLineStripIndices.emplaceBack(3);
        tileLineStripIndices.emplaceBack(2);
        tileLineStripIndices.emplaceBack(0);
        this.tileBorderIndexBuffer = context.createIndexBuffer(tileLineStripIndices);
        const quadTriangleIndices = new TriangleIndexArray();
        quadTriangleIndices.emplaceBack(1, 0, 2);
        quadTriangleIndices.emplaceBack(1, 2, 3);
        this.quadTriangleIndexBuffer = context.createIndexBuffer(quadTriangleIndices);
        const gl = this.context.gl;
        this.stencilClearMode = new StencilMode({ func: gl.ALWAYS, mask: 0 }, 0x0, 0xFF, gl.ZERO, gl.ZERO, gl.ZERO);
        this.tileExtentMesh = new Mesh(this.tileExtentBuffer, this.quadTriangleIndexBuffer, this.tileExtentSegments);
    }
    clearStencil() {
        const context = this.context;
        const gl = context.gl;
        this.nextStencilID = 1;
        this.currentStencilSource = undefined;
        const matrix = mat4.create();
        mat4.ortho(matrix, 0, this.width, this.height, 0, 0, 1);
        mat4.scale(matrix, matrix, [gl.drawingBufferWidth, gl.drawingBufferHeight, 0]);
        const projectionData = {
            mainMatrix: matrix,
            tileMercatorCoords: [0, 0, 1, 1],
            clippingPlane: [0, 0, 0, 0],
            projectionTransition: 0.0,
            fallbackMatrix: matrix,
        };
        this.useProgram('clippingMask', null, true).draw(context, gl.TRIANGLES, DepthMode.disabled, this.stencilClearMode, ColorMode.disabled, CullFaceMode.disabled, null, null, projectionData, '$clipping', this.viewportBuffer, this.quadTriangleIndexBuffer, this.viewportSegments);
    }
    _renderTileClippingMasks(layer, tileIDs, renderToTexture) {
        if (this.currentStencilSource === layer.source || !layer.isTileClipped() || !tileIDs || !tileIDs.length) {
            return;
        }
        this.currentStencilSource = layer.source;
        if (this.nextStencilID + tileIDs.length > 256) {
            this.clearStencil();
        }
        const context = this.context;
        context.setColorMode(ColorMode.disabled);
        context.setDepthMode(DepthMode.disabled);
        const stencilRefs = {};
        for (const tileID of tileIDs) {
            stencilRefs[tileID.key] = this.nextStencilID++;
        }
        this._renderTileMasks(stencilRefs, tileIDs, renderToTexture, true);
        this._renderTileMasks(stencilRefs, tileIDs, renderToTexture, false);
        this._tileClippingMaskIDs = stencilRefs;
    }
    _renderTileMasks(tileStencilRefs, tileIDs, renderToTexture, useBorders) {
        const context = this.context;
        const gl = context.gl;
        const projection = this.style.projection;
        const transform = this.transform;
        const program = this.useProgram('clippingMask');
        for (const tileID of tileIDs) {
            const stencilRef = tileStencilRefs[tileID.key];
            const terrainData = this.style.map.terrain && this.style.map.terrain.getTerrainData(tileID);
            const mesh = projection.getMeshFromTileID(this.context, tileID.canonical, useBorders, true, 'stencil');
            const projectionData = transform.getProjectionData({ overscaledTileID: tileID, applyGlobeMatrix: !renderToTexture, applyTerrainMatrix: true });
            program.draw(context, gl.TRIANGLES, DepthMode.disabled, new StencilMode({ func: gl.ALWAYS, mask: 0 }, stencilRef, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE), ColorMode.disabled, renderToTexture ? CullFaceMode.disabled : CullFaceMode.backCCW, null, terrainData, projectionData, '$clipping', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
        }
    }
    _renderTilesDepthBuffer() {
        const context = this.context;
        const gl = context.gl;
        const projection = this.style.projection;
        const transform = this.transform;
        const program = this.useProgram('depth');
        const depthMode = this.getDepthModeFor3D();
        const tileIDs = coveringTiles(transform, { tileSize: transform.tileSize });
        for (const tileID of tileIDs) {
            const terrainData = this.style.map.terrain && this.style.map.terrain.getTerrainData(tileID);
            const mesh = projection.getMeshFromTileID(this.context, tileID.canonical, true, true, 'raster');
            const projectionData = transform.getProjectionData({ overscaledTileID: tileID, applyGlobeMatrix: true, applyTerrainMatrix: true });
            program.draw(context, gl.TRIANGLES, depthMode, StencilMode.disabled, ColorMode.disabled, CullFaceMode.backCCW, null, terrainData, projectionData, '$clipping', mesh.vertexBuffer, mesh.indexBuffer, mesh.segments);
        }
    }
    stencilModeFor3D() {
        this.currentStencilSource = undefined;
        if (this.nextStencilID + 1 > 256) {
            this.clearStencil();
        }
        const id = this.nextStencilID++;
        const gl = this.context.gl;
        return new StencilMode({ func: gl.NOTEQUAL, mask: 0xFF }, id, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE);
    }
    stencilModeForClipping(tileID) {
        const gl = this.context.gl;
        return new StencilMode({ func: gl.EQUAL, mask: 0xFF }, this._tileClippingMaskIDs[tileID.key], 0x00, gl.KEEP, gl.KEEP, gl.REPLACE);
    }
    getStencilConfigForOverlapAndUpdateStencilID(tileIDs) {
        const gl = this.context.gl;
        const coords = tileIDs.sort((a, b) => b.overscaledZ - a.overscaledZ);
        const minTileZ = coords[coords.length - 1].overscaledZ;
        const stencilValues = coords[0].overscaledZ - minTileZ + 1;
        if (stencilValues > 1) {
            this.currentStencilSource = undefined;
            if (this.nextStencilID + stencilValues > 256) {
                this.clearStencil();
            }
            const zToStencilMode = {};
            for (let i = 0; i < stencilValues; i++) {
                zToStencilMode[i + minTileZ] = new StencilMode({ func: gl.GEQUAL, mask: 0xFF }, i + this.nextStencilID, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE);
            }
            this.nextStencilID += stencilValues;
            return [zToStencilMode, coords];
        }
        return [{ [minTileZ]: StencilMode.disabled }, coords];
    }
    stencilConfigForOverlapTwoPass(tileIDs) {
        const gl = this.context.gl;
        const coords = tileIDs.sort((a, b) => b.overscaledZ - a.overscaledZ);
        const minTileZ = coords[coords.length - 1].overscaledZ;
        const stencilValues = coords[0].overscaledZ - minTileZ + 1;
        this.clearStencil();
        if (stencilValues > 1) {
            const zToStencilModeHigh = {};
            const zToStencilModeLow = {};
            for (let i = 0; i < stencilValues; i++) {
                zToStencilModeHigh[i + minTileZ] = new StencilMode({ func: gl.GREATER, mask: 0xFF }, stencilValues + 1 + i, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE);
                zToStencilModeLow[i + minTileZ] = new StencilMode({ func: gl.GREATER, mask: 0xFF }, 1 + i, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE);
            }
            this.nextStencilID = stencilValues * 2 + 1;
            return [
                zToStencilModeHigh,
                zToStencilModeLow,
                coords
            ];
        }
        else {
            this.nextStencilID = 3;
            return [
                { [minTileZ]: new StencilMode({ func: gl.GREATER, mask: 0xFF }, 2, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE) },
                { [minTileZ]: new StencilMode({ func: gl.GREATER, mask: 0xFF }, 1, 0xFF, gl.KEEP, gl.KEEP, gl.REPLACE) },
                coords
            ];
        }
    }
    colorModeForRenderPass() {
        const gl = this.context.gl;
        if (this._showOverdrawInspector) {
            const numOverdrawSteps = 8;
            const a = 1 / numOverdrawSteps;
            return new ColorMode([gl.CONSTANT_COLOR, gl.ONE], new Color(a, a, a, 0), [true, true, true, true]);
        }
        else if (this.renderPass === 'opaque') {
            return ColorMode.unblended;
        }
        else {
            return ColorMode.alphaBlended;
        }
    }
    getDepthModeForSublayer(n, mask, func) {
        if (!this.opaquePassEnabledForLayer())
            return DepthMode.disabled;
        const depth = 1 - ((1 + this.currentLayer) * this.numSublayers + n) * this.depthEpsilon;
        return new DepthMode(func || this.context.gl.LEQUAL, mask, [depth, depth]);
    }
    getDepthModeFor3D() {
        return new DepthMode(this.context.gl.LEQUAL, DepthMode.ReadWrite, this.depthRangeFor3D);
    }
    opaquePassEnabledForLayer() {
        return this.currentLayer < this.opaquePassCutoff;
    }
    render(style, options) {
        var _a, _b, _c, _d;
        this.style = style;
        this.options = options;
        this.lineAtlas = style.lineAtlas;
        this.imageManager = style.imageManager;
        this.glyphManager = style.glyphManager;
        this.symbolFadeChange = (_b = (_a = style.placement) === null || _a === void 0 ? void 0 : _a.symbolFadeChange(browser.now())) !== null && _b !== void 0 ? _b : 1;
        this.imageManager.beginFrame();
        const layerIds = this.style._order;
        const sourceCaches = this.style.sourceCaches;
        const coordsAscending = {};
        const coordsDescending = {};
        const coordsDescendingSymbol = {};
        const renderOptions = { isRenderingToTexture: false, isRenderingGlobe: ((_c = style.projection) === null || _c === void 0 ? void 0 : _c.transitionState) > 0 };
        for (const id in sourceCaches) {
            const sourceCache = sourceCaches[id];
            if (sourceCache.used) {
                sourceCache.prepare(this.context);
            }
            coordsAscending[id] = sourceCache.getVisibleCoordinates(false);
            coordsDescending[id] = coordsAscending[id].slice().reverse();
            coordsDescendingSymbol[id] = sourceCache.getVisibleCoordinates(true).reverse();
        }
        this.opaquePassCutoff = Infinity;
        for (let i = 0; i < layerIds.length; i++) {
            const layerId = layerIds[i];
            if (this.style._layers[layerId].is3D()) {
                this.opaquePassCutoff = i;
                break;
            }
        }
        this.maybeDrawDepthAndCoords(false);
        if (this.renderToTexture) {
            this.renderToTexture.prepareForRender(this.style, this.transform.zoom);
            this.opaquePassCutoff = 0;
        }
        this.renderPass = 'offscreen';
        for (const layerId of layerIds) {
            const layer = this.style._layers[layerId];
            if (!layer.hasOffscreenPass() || layer.isHidden(this.transform.zoom))
                continue;
            const coords = coordsDescending[layer.source];
            if (layer.type !== 'custom' && !coords.length)
                continue;
            this.renderLayer(this, sourceCaches[layer.source], layer, coords, renderOptions);
        }
        (_d = this.style.projection) === null || _d === void 0 ? void 0 : _d.updateGPUdependent({
            context: this.context,
            useProgram: (name) => this.useProgram(name)
        });
        this.context.viewport.set([0, 0, this.width, this.height]);
        this.context.bindFramebuffer.set(null);
        this.context.clear({ color: options.showOverdrawInspector ? Color.black : Color.transparent, depth: 1 });
        this.clearStencil();
        if (this.style.sky)
            drawSky(this, this.style.sky);
        this._showOverdrawInspector = options.showOverdrawInspector;
        this.depthRangeFor3D = [0, 1 - ((style._order.length + 2) * this.numSublayers * this.depthEpsilon)];
        if (!this.renderToTexture) {
            this.renderPass = 'opaque';
            for (this.currentLayer = layerIds.length - 1; this.currentLayer >= 0; this.currentLayer--) {
                const layer = this.style._layers[layerIds[this.currentLayer]];
                const sourceCache = sourceCaches[layer.source];
                const coords = coordsAscending[layer.source];
                this._renderTileClippingMasks(layer, coords, false);
                this.renderLayer(this, sourceCache, layer, coords, renderOptions);
            }
        }
        this.renderPass = 'translucent';
        let globeDepthRendered = false;
        for (this.currentLayer = 0; this.currentLayer < layerIds.length; this.currentLayer++) {
            const layer = this.style._layers[layerIds[this.currentLayer]];
            const sourceCache = sourceCaches[layer.source];
            if (this.renderToTexture && this.renderToTexture.renderLayer(layer, renderOptions))
                continue;
            if (!this.opaquePassEnabledForLayer() && !globeDepthRendered) {
                globeDepthRendered = true;
                if (renderOptions.isRenderingGlobe && !this.style.map.terrain) {
                    this._renderTilesDepthBuffer();
                }
            }
            const coords = (layer.type === 'symbol' ? coordsDescendingSymbol : coordsDescending)[layer.source];
            this._renderTileClippingMasks(layer, coordsAscending[layer.source], !!this.renderToTexture);
            this.renderLayer(this, sourceCache, layer, coords, renderOptions);
        }
        if (renderOptions.isRenderingGlobe) {
            drawAtmosphere(this, this.style.sky, this.style.light);
        }
        if (this.options.showTileBoundaries) {
            const selectedSource = selectDebugSource(this.style, this.transform.zoom);
            if (selectedSource) {
                drawDebug(this, selectedSource, selectedSource.getVisibleCoordinates());
            }
        }
        if (this.options.showPadding) {
            drawDebugPadding(this);
        }
        this.context.setDefault();
    }
    maybeDrawDepthAndCoords(requireExact) {
        if (!this.style || !this.style.map || !this.style.map.terrain) {
            return;
        }
        const prevMatrix = this.terrainFacilitator.matrix;
        const currMatrix = this.transform.modelViewProjectionMatrix;
        let doUpdate = this.terrainFacilitator.dirty;
        doUpdate || (doUpdate = requireExact ? !mat4.exactEquals(prevMatrix, currMatrix) : !mat4.equals(prevMatrix, currMatrix));
        doUpdate || (doUpdate = this.style.map.terrain.sourceCache.anyTilesAfterTime(this.terrainFacilitator.renderTime));
        if (!doUpdate) {
            return;
        }
        mat4.copy(prevMatrix, currMatrix);
        this.terrainFacilitator.renderTime = Date.now();
        this.terrainFacilitator.dirty = false;
        drawDepth(this, this.style.map.terrain);
        drawCoords(this, this.style.map.terrain);
    }
    renderLayer(painter, sourceCache, layer, coords, renderOptions) {
        if (layer.isHidden(this.transform.zoom))
            return;
        if (layer.type !== 'background' && layer.type !== 'custom' && !(coords || []).length)
            return;
        this.id = layer.id;
        if (isCustomStyleLayer(layer)) {
            drawCustom(painter, sourceCache, layer, renderOptions);
            return;
        }
        const drawFn = getDrawFunction(layer.type);
        if (drawFn) {
            drawFn(painter, sourceCache, layer, coords, renderOptions);
        }
    }
    saveTileTexture(texture) {
        const textures = this._tileTextures[texture.size[0]];
        if (!textures) {
            this._tileTextures[texture.size[0]] = [texture];
        }
        else {
            textures.push(texture);
        }
    }
    getTileTexture(size) {
        const textures = this._tileTextures[size];
        return textures && textures.length > 0 ? textures.pop() : null;
    }
    isPatternMissing(image) {
        if (!image)
            return false;
        if (!image.from || !image.to)
            return true;
        const imagePosA = this.imageManager.getPattern(image.from.toString());
        const imagePosB = this.imageManager.getPattern(image.to.toString());
        return !imagePosA || !imagePosB;
    }
    useProgram(name, programConfiguration, forceSimpleProjection = false, defines = []) {
        this.cache = this.cache || {};
        const useTerrain = !!this.style.map.terrain;
        const projection = this.style.projection;
        const projectionPrelude = forceSimpleProjection ? getShaders().projectionMercator : projection.shaderPreludeCode;
        const projectionDefine = forceSimpleProjection ? MercatorShaderDefine : projection.shaderDefine;
        const projectionKey = `/${forceSimpleProjection ? MercatorShaderVariantKey : projection.shaderVariantName}`;
        const configurationKey = (programConfiguration ? programConfiguration.cacheKey : '');
        const overdrawKey = (this._showOverdrawInspector ? '/overdraw' : '');
        const terrainKey = (useTerrain ? '/terrain' : '');
        const definesKey = (defines ? `/${defines.join('/')}` : '');
        const key = name + configurationKey + projectionKey + overdrawKey + terrainKey + definesKey;
        if (!this.cache[key]) {
            const registryShaders = getShaders();
            const shader = registryShaders[name];
            this.cache[key] = new Program(this.context, shader, programConfiguration, programUniforms[name], this._showOverdrawInspector, useTerrain, projectionPrelude, projectionDefine, defines);
        }
        return this.cache[key];
    }
    setCustomLayerDefaults() {
        this.context.unbindVAO();
        this.context.cullFace.setDefault();
        this.context.activeTexture.setDefault();
        this.context.pixelStoreUnpack.setDefault();
        this.context.pixelStoreUnpackPremultiplyAlpha.setDefault();
        this.context.pixelStoreUnpackFlipY.setDefault();
    }
    setBaseState() {
        const gl = this.context.gl;
        this.context.cullFace.set(false);
        this.context.viewport.set([0, 0, this.width, this.height]);
        this.context.blendEquation.set(gl.FUNC_ADD);
    }
    initDebugOverlayCanvas() {
        if (this.debugOverlayCanvas == null) {
            this.debugOverlayCanvas = document.createElement('canvas');
            this.debugOverlayCanvas.width = 512;
            this.debugOverlayCanvas.height = 512;
            const gl = this.context.gl;
            this.debugOverlayTexture = new Texture(this.context, this.debugOverlayCanvas, gl.RGBA);
        }
    }
    destroy() {
        if (this.debugOverlayTexture) {
            this.debugOverlayTexture.destroy();
        }
    }
    overLimit() {
        const { drawingBufferWidth, drawingBufferHeight } = this.context.gl;
        return this.width !== drawingBufferWidth || this.height !== drawingBufferHeight;
    }
}
//# sourceMappingURL=painter.js.map