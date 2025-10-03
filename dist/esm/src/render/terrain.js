import { mat4, vec2 } from 'gl-matrix';
import { OverscaledTileID } from '../source/tile_id';
import { RGBAImage } from '../util/image';
import { warnOnce } from '../util/util';
import { Pos3dArray, TriangleIndexArray } from '../data/array_types.g';
import pos3dAttributes from '../data/pos3d_attributes';
import { SegmentVector } from '../data/segment';
import { Texture } from '../render/texture';
import { MercatorCoordinate } from '../geo/mercator_coordinate';
import { TerrainSourceCache } from '../source/terrain_source_cache';
import { EXTENT } from '../data/extent';
import { earthRadius } from '../geo/lng_lat';
import { Mesh } from './mesh';
import { isInBoundsForZoomLngLat } from '../util/world_bounds';
import { NORTH_POLE_Y, SOUTH_POLE_Y } from './subdivision';
export class Terrain {
    constructor(painter, sourceCache, options) {
        this._meshCache = {};
        this.painter = painter;
        this.sourceCache = new TerrainSourceCache(sourceCache);
        this.options = options;
        this.exaggeration = typeof options.exaggeration === 'number' ? options.exaggeration : 1.0;
        this.qualityFactor = 2;
        this.meshSize = 128;
        this._demMatrixCache = {};
        this.coordsIndex = [];
        this._coordsTextureSize = 1024;
    }
    getDEMElevation(tileID, x, y, extent = EXTENT) {
        var _a;
        if (!(x >= 0 && x < extent && y >= 0 && y < extent))
            return 0;
        const terrain = this.getTerrainData(tileID);
        const dem = (_a = terrain.tile) === null || _a === void 0 ? void 0 : _a.dem;
        if (!dem)
            return 0;
        const pos = vec2.transformMat4([], [x / extent * EXTENT, y / extent * EXTENT], terrain.u_terrain_matrix);
        const coord = [pos[0] * dem.dim, pos[1] * dem.dim];
        const cx = Math.floor(coord[0]), cy = Math.floor(coord[1]), tx = coord[0] - cx, ty = coord[1] - cy;
        return (dem.get(cx, cy) * (1 - tx) * (1 - ty) +
            dem.get(cx + 1, cy) * (tx) * (1 - ty) +
            dem.get(cx, cy + 1) * (1 - tx) * (ty) +
            dem.get(cx + 1, cy + 1) * (tx) * (ty));
    }
    getElevationForLngLatZoom(lnglat, zoom) {
        if (!isInBoundsForZoomLngLat(zoom, lnglat.wrap()))
            return 0;
        const { tileID, mercatorX, mercatorY } = this._getOverscaledTileIDFromLngLatZoom(lnglat, zoom);
        return this.getElevation(tileID, mercatorX % EXTENT, mercatorY % EXTENT, EXTENT);
    }
    getElevation(tileID, x, y, extent = EXTENT) {
        return this.getDEMElevation(tileID, x, y, extent) * this.exaggeration;
    }
    getTerrainData(tileID) {
        if (!this._emptyDemTexture) {
            const context = this.painter.context;
            const image = new RGBAImage({ width: 1, height: 1 }, new Uint8Array(1 * 4));
            this._emptyDepthTexture = new Texture(context, image, context.gl.RGBA, { premultiply: false });
            this._emptyDemUnpack = [0, 0, 0, 0];
            this._emptyDemTexture = new Texture(context, new RGBAImage({ width: 1, height: 1 }), context.gl.RGBA, { premultiply: false });
            this._emptyDemTexture.bind(context.gl.NEAREST, context.gl.CLAMP_TO_EDGE);
            this._emptyDemMatrix = mat4.identity([]);
        }
        const sourceTile = this.sourceCache.getSourceTile(tileID, true);
        if (sourceTile && sourceTile.dem && (!sourceTile.demTexture || sourceTile.needsTerrainPrepare)) {
            const context = this.painter.context;
            sourceTile.demTexture = this.painter.getTileTexture(sourceTile.dem.stride);
            if (sourceTile.demTexture)
                sourceTile.demTexture.update(sourceTile.dem.getPixels(), { premultiply: false });
            else
                sourceTile.demTexture = new Texture(context, sourceTile.dem.getPixels(), context.gl.RGBA, { premultiply: false });
            sourceTile.demTexture.bind(context.gl.NEAREST, context.gl.CLAMP_TO_EDGE);
            sourceTile.needsTerrainPrepare = false;
        }
        const matrixKey = sourceTile && (sourceTile + sourceTile.tileID.key) + tileID.key;
        if (matrixKey && !this._demMatrixCache[matrixKey]) {
            const maxzoom = this.sourceCache.sourceCache._source.maxzoom;
            let dz = tileID.canonical.z - sourceTile.tileID.canonical.z;
            if (tileID.overscaledZ > tileID.canonical.z) {
                if (tileID.canonical.z >= maxzoom)
                    dz = tileID.canonical.z - maxzoom;
                else
                    warnOnce('cannot calculate elevation if elevation maxzoom > source.maxzoom');
            }
            const dx = tileID.canonical.x - (tileID.canonical.x >> dz << dz);
            const dy = tileID.canonical.y - (tileID.canonical.y >> dz << dz);
            const demMatrix = mat4.fromScaling(new Float64Array(16), [1 / (EXTENT << dz), 1 / (EXTENT << dz), 0]);
            mat4.translate(demMatrix, demMatrix, [dx * EXTENT, dy * EXTENT, 0]);
            this._demMatrixCache[tileID.key] = { matrix: demMatrix, coord: tileID };
        }
        return {
            'u_depth': 2,
            'u_terrain': 3,
            'u_terrain_dim': sourceTile && sourceTile.dem && sourceTile.dem.dim || 1,
            'u_terrain_matrix': matrixKey ? this._demMatrixCache[tileID.key].matrix : this._emptyDemMatrix,
            'u_terrain_unpack': sourceTile && sourceTile.dem && sourceTile.dem.getUnpackVector() || this._emptyDemUnpack,
            'u_terrain_exaggeration': this.exaggeration,
            texture: (sourceTile && sourceTile.demTexture || this._emptyDemTexture).texture,
            depthTexture: (this._fboDepthTexture || this._emptyDepthTexture).texture,
            tile: sourceTile
        };
    }
    getFramebuffer(texture) {
        const painter = this.painter;
        const width = painter.width / devicePixelRatio;
        const height = painter.height / devicePixelRatio;
        if (this._fbo && (this._fbo.width !== width || this._fbo.height !== height)) {
            this._fbo.destroy();
            this._fboCoordsTexture.destroy();
            this._fboDepthTexture.destroy();
            delete this._fbo;
            delete this._fboDepthTexture;
            delete this._fboCoordsTexture;
        }
        if (!this._fboCoordsTexture) {
            this._fboCoordsTexture = new Texture(painter.context, { width, height, data: null }, painter.context.gl.RGBA, { premultiply: false });
            this._fboCoordsTexture.bind(painter.context.gl.NEAREST, painter.context.gl.CLAMP_TO_EDGE);
        }
        if (!this._fboDepthTexture) {
            this._fboDepthTexture = new Texture(painter.context, { width, height, data: null }, painter.context.gl.RGBA, { premultiply: false });
            this._fboDepthTexture.bind(painter.context.gl.NEAREST, painter.context.gl.CLAMP_TO_EDGE);
        }
        if (!this._fbo) {
            this._fbo = painter.context.createFramebuffer(width, height, true, false);
            this._fbo.depthAttachment.set(painter.context.createRenderbuffer(painter.context.gl.DEPTH_COMPONENT16, width, height));
        }
        this._fbo.colorAttachment.set(texture === 'coords' ? this._fboCoordsTexture.texture : this._fboDepthTexture.texture);
        return this._fbo;
    }
    getCoordsTexture() {
        const context = this.painter.context;
        if (this._coordsTexture)
            return this._coordsTexture;
        const data = new Uint8Array(this._coordsTextureSize * this._coordsTextureSize * 4);
        for (let y = 0, i = 0; y < this._coordsTextureSize; y++)
            for (let x = 0; x < this._coordsTextureSize; x++, i += 4) {
                data[i + 0] = x & 255;
                data[i + 1] = y & 255;
                data[i + 2] = ((x >> 8) << 4) | (y >> 8);
                data[i + 3] = 0;
            }
        const image = new RGBAImage({ width: this._coordsTextureSize, height: this._coordsTextureSize }, new Uint8Array(data.buffer));
        const texture = new Texture(context, image, context.gl.RGBA, { premultiply: false });
        texture.bind(context.gl.NEAREST, context.gl.CLAMP_TO_EDGE);
        this._coordsTexture = texture;
        return texture;
    }
    pointCoordinate(p) {
        this.painter.maybeDrawDepthAndCoords(true);
        const rgba = new Uint8Array(4);
        const context = this.painter.context, gl = context.gl;
        const px = Math.round(p.x * this.painter.pixelRatio / devicePixelRatio);
        const py = Math.round(p.y * this.painter.pixelRatio / devicePixelRatio);
        const fbHeight = Math.round(this.painter.height / devicePixelRatio);
        context.bindFramebuffer.set(this.getFramebuffer('coords').framebuffer);
        gl.readPixels(px, fbHeight - py - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
        context.bindFramebuffer.set(null);
        const x = rgba[0] + ((rgba[2] >> 4) << 8);
        const y = rgba[1] + ((rgba[2] & 15) << 8);
        const tileID = this.coordsIndex[255 - rgba[3]];
        const tile = tileID && this.sourceCache.getTileByID(tileID);
        if (!tile) {
            return null;
        }
        const coordsSize = this._coordsTextureSize;
        const worldSize = (1 << tile.tileID.canonical.z) * coordsSize;
        return new MercatorCoordinate((tile.tileID.canonical.x * coordsSize + x) / worldSize + tile.tileID.wrap, (tile.tileID.canonical.y * coordsSize + y) / worldSize, this.getElevation(tile.tileID, x, y, coordsSize));
    }
    depthAtPoint(p) {
        const rgba = new Uint8Array(4);
        const context = this.painter.context, gl = context.gl;
        context.bindFramebuffer.set(this.getFramebuffer('depth').framebuffer);
        gl.readPixels(p.x, this.painter.height / devicePixelRatio - p.y - 1, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
        context.bindFramebuffer.set(null);
        const depthValue = (rgba[0] / (256 * 256 * 256) + rgba[1] / (256 * 256) + rgba[2] / 256 + rgba[3]) / 256;
        return depthValue;
    }
    getTerrainMesh(tileId) {
        var _a;
        const globeEnabled = ((_a = this.painter.style.projection) === null || _a === void 0 ? void 0 : _a.transitionState) > 0;
        const northPole = globeEnabled && tileId.canonical.y === 0;
        const southPole = globeEnabled && tileId.canonical.y === (1 << tileId.canonical.z) - 1;
        const key = `m_${northPole ? 'n' : ''}_${southPole ? 's' : ''}`;
        if (this._meshCache[key]) {
            return this._meshCache[key];
        }
        const context = this.painter.context;
        const vertexArray = new Pos3dArray();
        const indexArray = new TriangleIndexArray();
        const meshSize = this.meshSize;
        const delta = EXTENT / meshSize;
        const meshSize2 = meshSize * meshSize;
        for (let y = 0; y <= meshSize; y++)
            for (let x = 0; x <= meshSize; x++) {
                vertexArray.emplaceBack(x * delta, y * delta, 0);
            }
        for (let y = 0; y < meshSize2; y += meshSize + 1)
            for (let x = 0; x < meshSize; x++) {
                indexArray.emplaceBack(x + y, meshSize + x + y + 1, meshSize + x + y + 2);
                indexArray.emplaceBack(x + y, meshSize + x + y + 2, x + y + 1);
            }
        const offsetTop = vertexArray.length;
        const offsetTopEdge = 0;
        const offsetBottom = offsetTop + (meshSize + 1);
        const offsetBottomEdge = (meshSize + 1) * meshSize;
        const northY = northPole ? NORTH_POLE_Y : 0;
        const northZ = northPole ? 0 : 1;
        const southY = southPole ? SOUTH_POLE_Y : EXTENT;
        const southZ = southPole ? 0 : 1;
        for (let x = 0; x <= meshSize; x++) {
            vertexArray.emplaceBack(x * delta, northY, northZ);
        }
        for (let x = 0; x <= meshSize; x++) {
            vertexArray.emplaceBack(x * delta, southY, southZ);
        }
        for (let x = 0; x < meshSize; x++) {
            indexArray.emplaceBack(offsetBottomEdge + x, offsetBottom + x, offsetBottom + x + 1);
            indexArray.emplaceBack(offsetBottomEdge + x, offsetBottom + x + 1, offsetBottomEdge + x + 1);
            indexArray.emplaceBack(offsetTopEdge + x, offsetTop + x + 1, offsetTop + x);
            indexArray.emplaceBack(offsetTopEdge + x, offsetTopEdge + x + 1, offsetTop + x + 1);
        }
        const offsetLeft = vertexArray.length;
        const offsetRight = offsetLeft + (meshSize + 1) * 2;
        for (const x of [0, 1])
            for (let y = 0; y <= meshSize; y++)
                for (const z of [0, 1]) {
                    vertexArray.emplaceBack(x * EXTENT, y * delta, z);
                }
        for (let y = 0; y < meshSize * 2; y += 2) {
            indexArray.emplaceBack(offsetLeft + y, offsetLeft + y + 1, offsetLeft + y + 3);
            indexArray.emplaceBack(offsetLeft + y, offsetLeft + y + 3, offsetLeft + y + 2);
            indexArray.emplaceBack(offsetRight + y, offsetRight + y + 3, offsetRight + y + 1);
            indexArray.emplaceBack(offsetRight + y, offsetRight + y + 2, offsetRight + y + 3);
        }
        const mesh = new Mesh(context.createVertexBuffer(vertexArray, pos3dAttributes.members), context.createIndexBuffer(indexArray), SegmentVector.simpleSegment(0, 0, vertexArray.length, indexArray.length));
        this._meshCache[key] = mesh;
        return mesh;
    }
    getMeshFrameDelta(zoom) {
        return 2 * Math.PI * earthRadius / Math.pow(2, Math.max(zoom, 0)) / 5;
    }
    getMinTileElevationForLngLatZoom(lnglat, zoom) {
        var _a;
        const { tileID } = this._getOverscaledTileIDFromLngLatZoom(lnglat, zoom);
        return (_a = this.getMinMaxElevation(tileID).minElevation) !== null && _a !== void 0 ? _a : 0;
    }
    getMinMaxElevation(tileID) {
        const tile = this.getTerrainData(tileID).tile;
        const minMax = { minElevation: null, maxElevation: null };
        if (tile && tile.dem) {
            minMax.minElevation = tile.dem.min * this.exaggeration;
            minMax.maxElevation = tile.dem.max * this.exaggeration;
        }
        return minMax;
    }
    _getOverscaledTileIDFromLngLatZoom(lnglat, zoom) {
        const mercatorCoordinate = MercatorCoordinate.fromLngLat(lnglat.wrap());
        const worldSize = (1 << zoom) * EXTENT;
        const mercatorX = mercatorCoordinate.x * worldSize;
        const mercatorY = mercatorCoordinate.y * worldSize;
        const tileX = Math.floor(mercatorX / EXTENT), tileY = Math.floor(mercatorY / EXTENT);
        const tileID = new OverscaledTileID(zoom, 0, zoom, tileX, tileY);
        return {
            tileID,
            mercatorX,
            mercatorY
        };
    }
}
//# sourceMappingURL=terrain.js.map