import { Tile } from './tile';
import { EXTENT } from '../data/extent';
import { mat4 } from 'gl-matrix';
import { Evented } from '../util/evented';
import { browser } from '../util/browser';
import { coveringTiles } from '../geo/projection/covering_tiles';
import { createMat4f64 } from '../util/util';
export class TerrainSourceCache extends Evented {
    constructor(sourceCache) {
        super();
        this._lastTilesetChange = browser.now();
        this.sourceCache = sourceCache;
        this._tiles = {};
        this._renderableTilesKeys = [];
        this._sourceTileCache = {};
        this.minzoom = 0;
        this.maxzoom = 22;
        this.deltaZoom = 1;
        this.tileSize = sourceCache._source.tileSize * 2 ** this.deltaZoom;
        sourceCache.usedForTerrain = true;
        sourceCache.tileSize = this.tileSize;
    }
    destruct() {
        this.sourceCache.usedForTerrain = false;
        this.sourceCache.tileSize = null;
    }
    update(transform, terrain) {
        this.sourceCache.update(transform, terrain);
        this._renderableTilesKeys = [];
        const keys = {};
        for (const tileID of coveringTiles(transform, {
            tileSize: this.tileSize,
            minzoom: this.minzoom,
            maxzoom: this.maxzoom,
            reparseOverscaled: false,
            terrain,
            calculateTileZoom: this.sourceCache._source.calculateTileZoom
        })) {
            keys[tileID.key] = true;
            this._renderableTilesKeys.push(tileID.key);
            if (!this._tiles[tileID.key]) {
                tileID.terrainRttPosMatrix32f = new Float64Array(16);
                mat4.ortho(tileID.terrainRttPosMatrix32f, 0, EXTENT, EXTENT, 0, 0, 1);
                this._tiles[tileID.key] = new Tile(tileID, this.tileSize);
                this._lastTilesetChange = browser.now();
            }
        }
        for (const key in this._tiles) {
            if (!keys[key])
                delete this._tiles[key];
        }
    }
    freeRtt(tileID) {
        for (const key in this._tiles) {
            const tile = this._tiles[key];
            if (!tileID || tile.tileID.equals(tileID) || tile.tileID.isChildOf(tileID) || tileID.isChildOf(tile.tileID))
                tile.rtt = [];
        }
    }
    getRenderableTiles() {
        return this._renderableTilesKeys.map(key => this.getTileByID(key));
    }
    getTileByID(id) {
        return this._tiles[id];
    }
    getTerrainCoords(tileID, terrainTileRanges) {
        if (terrainTileRanges) {
            return this._getTerrainCoordsForTileRanges(tileID, terrainTileRanges);
        }
        else {
            return this._getTerrainCoordsForRegularTile(tileID);
        }
    }
    _getTerrainCoordsForRegularTile(tileID) {
        const coords = {};
        for (const key of this._renderableTilesKeys) {
            const terrainTileID = this._tiles[key].tileID;
            const coord = tileID.clone();
            const mat = createMat4f64();
            if (terrainTileID.canonical.equals(tileID.canonical)) {
                mat4.ortho(mat, 0, EXTENT, EXTENT, 0, 0, 1);
            }
            else if (terrainTileID.canonical.isChildOf(tileID.canonical)) {
                const dz = terrainTileID.canonical.z - tileID.canonical.z;
                const dx = terrainTileID.canonical.x - (terrainTileID.canonical.x >> dz << dz);
                const dy = terrainTileID.canonical.y - (terrainTileID.canonical.y >> dz << dz);
                const size = EXTENT >> dz;
                mat4.ortho(mat, 0, size, size, 0, 0, 1);
                mat4.translate(mat, mat, [-dx * size, -dy * size, 0]);
            }
            else if (tileID.canonical.isChildOf(terrainTileID.canonical)) {
                const dz = tileID.canonical.z - terrainTileID.canonical.z;
                const dx = tileID.canonical.x - (tileID.canonical.x >> dz << dz);
                const dy = tileID.canonical.y - (tileID.canonical.y >> dz << dz);
                const size = EXTENT >> dz;
                mat4.ortho(mat, 0, EXTENT, EXTENT, 0, 0, 1);
                mat4.translate(mat, mat, [dx * size, dy * size, 0]);
                mat4.scale(mat, mat, [1 / (2 ** dz), 1 / (2 ** dz), 0]);
            }
            else {
                continue;
            }
            coord.terrainRttPosMatrix32f = new Float32Array(mat);
            coords[key] = coord;
        }
        return coords;
    }
    _getTerrainCoordsForTileRanges(tileID, terrainTileRanges) {
        const coords = {};
        for (const key of this._renderableTilesKeys) {
            const terrainTileID = this._tiles[key].tileID;
            if (!this._isWithinTileRanges(terrainTileID, terrainTileRanges)) {
                continue;
            }
            const coord = tileID.clone();
            const mat = createMat4f64();
            if (terrainTileID.canonical.z === tileID.canonical.z) {
                const dx = tileID.canonical.x - terrainTileID.canonical.x;
                const dy = tileID.canonical.y - terrainTileID.canonical.y;
                mat4.ortho(mat, 0, EXTENT, EXTENT, 0, 0, 1);
                mat4.translate(mat, mat, [dx * EXTENT, dy * EXTENT, 0]);
            }
            else if (terrainTileID.canonical.z > tileID.canonical.z) {
                const dz = terrainTileID.canonical.z - tileID.canonical.z;
                const dx = terrainTileID.canonical.x - (terrainTileID.canonical.x >> dz << dz);
                const dy = terrainTileID.canonical.y - (terrainTileID.canonical.y >> dz << dz);
                const dx2 = tileID.canonical.x - (terrainTileID.canonical.x >> dz);
                const dy2 = tileID.canonical.y - (terrainTileID.canonical.y >> dz);
                const size = EXTENT >> dz;
                mat4.ortho(mat, 0, size, size, 0, 0, 1);
                mat4.translate(mat, mat, [-dx * size + dx2 * EXTENT, -dy * size + dy2 * EXTENT, 0]);
            }
            else {
                const dz = tileID.canonical.z - terrainTileID.canonical.z;
                const dx = tileID.canonical.x - (tileID.canonical.x >> dz << dz);
                const dy = tileID.canonical.y - (tileID.canonical.y >> dz << dz);
                const dx2 = (tileID.canonical.x >> dz) - terrainTileID.canonical.x;
                const dy2 = (tileID.canonical.y >> dz) - terrainTileID.canonical.y;
                const size = EXTENT << dz;
                mat4.ortho(mat, 0, size, size, 0, 0, 1);
                mat4.translate(mat, mat, [dx * EXTENT + dx2 * size, dy * EXTENT + dy2 * size, 0]);
            }
            coord.terrainRttPosMatrix32f = new Float32Array(mat);
            coords[key] = coord;
        }
        return coords;
    }
    getSourceTile(tileID, searchForDEM) {
        const source = this.sourceCache._source;
        let z = tileID.overscaledZ - this.deltaZoom;
        if (z > source.maxzoom)
            z = source.maxzoom;
        if (z < source.minzoom)
            return null;
        if (!this._sourceTileCache[tileID.key])
            this._sourceTileCache[tileID.key] = tileID.scaledTo(z).key;
        let tile = this.sourceCache.getTileByID(this._sourceTileCache[tileID.key]);
        if (!(tile && tile.dem) && searchForDEM)
            while (z >= source.minzoom && !(tile && tile.dem))
                tile = this.sourceCache.getTileByID(tileID.scaledTo(z--).key);
        return tile;
    }
    anyTilesAfterTime(time = Date.now()) {
        return this._lastTilesetChange >= time;
    }
    _isWithinTileRanges(tileID, canonicalTileRanges) {
        return canonicalTileRanges[tileID.canonical.z] &&
            tileID.canonical.x >= canonicalTileRanges[tileID.canonical.z].minTileX &&
            tileID.canonical.x <= canonicalTileRanges[tileID.canonical.z].maxTileX &&
            tileID.canonical.y >= canonicalTileRanges[tileID.canonical.z].minTileY &&
            tileID.canonical.y <= canonicalTileRanges[tileID.canonical.z].maxTileY;
    }
}
//# sourceMappingURL=terrain_source_cache.js.map