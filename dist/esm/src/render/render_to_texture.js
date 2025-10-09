import { Color } from '@maplibre/maplibre-gl-style-spec';
import { drawTerrain } from './draw_terrain';
import { RenderPool } from '../gl/render_pool';
import { registry } from '../registry';
const LAYERS = {
    background: true,
    fill: true,
    line: true,
    raster: true,
    hillshade: true,
    'color-relief': true
};
export class RenderToTexture {
    constructor(painter, terrain) {
        this.painter = painter;
        this.terrain = terrain;
        this.pool = new RenderPool(painter.context, 30, terrain.sourceCache.tileSize * terrain.qualityFactor);
    }
    destruct() {
        this.pool.destruct();
    }
    getTexture(tile) {
        return this.pool.getObjectForId(tile.rtt[this._stacks.length - 1].id).texture;
    }
    prepareForRender(style, zoom) {
        this._stacks = [];
        this._prevType = null;
        this._rttTiles = [];
        this._renderableTiles = this.terrain.sourceCache.getRenderableTiles();
        this._renderableLayerIds = style._order.filter(id => !style._layers[id].isHidden(zoom));
        this._coordsAscending = {};
        for (const id in style.sourceCaches) {
            this._coordsAscending[id] = {};
            const tileIDs = style.sourceCaches[id].getVisibleCoordinates();
            const source = style.sourceCaches[id].getSource();
            const terrainTileRanges = registry.source.image && source instanceof registry.source.image ? source.terrainTileRanges : null;
            for (const tileID of tileIDs) {
                const keys = this.terrain.sourceCache.getTerrainCoords(tileID, terrainTileRanges);
                for (const key in keys) {
                    if (!this._coordsAscending[id][key])
                        this._coordsAscending[id][key] = [];
                    this._coordsAscending[id][key].push(keys[key]);
                }
            }
        }
        this._coordsAscendingStr = {};
        for (const id of style._order) {
            const layer = style._layers[id], source = layer.source;
            if (LAYERS[layer.type]) {
                if (!this._coordsAscendingStr[source]) {
                    this._coordsAscendingStr[source] = {};
                    for (const key in this._coordsAscending[source])
                        this._coordsAscendingStr[source][key] = this._coordsAscending[source][key].map(c => c.key).sort().join();
                }
            }
        }
        for (const tile of this._renderableTiles) {
            for (const source in this._coordsAscendingStr) {
                const coords = this._coordsAscendingStr[source][tile.tileID.key];
                if (coords && coords !== tile.rttCoords[source])
                    tile.rtt = [];
            }
        }
    }
    renderLayer(layer, renderOptions) {
        if (layer.isHidden(this.painter.transform.zoom))
            return false;
        const options = Object.assign(Object.assign({}, renderOptions), { isRenderingToTexture: true });
        const type = layer.type;
        const painter = this.painter;
        const isLastLayer = this._renderableLayerIds[this._renderableLayerIds.length - 1] === layer.id;
        if (LAYERS[type]) {
            if (!this._prevType || !LAYERS[this._prevType])
                this._stacks.push([]);
            this._prevType = type;
            this._stacks[this._stacks.length - 1].push(layer.id);
            if (!isLastLayer)
                return true;
        }
        if (LAYERS[this._prevType] || (LAYERS[type] && isLastLayer)) {
            this._prevType = type;
            const stack = this._stacks.length - 1, layers = this._stacks[stack] || [];
            for (const tile of this._renderableTiles) {
                if (this.pool.isFull()) {
                    drawTerrain(this.painter, this.terrain, this._rttTiles, options);
                    this._rttTiles = [];
                    this.pool.freeAllObjects();
                }
                this._rttTiles.push(tile);
                if (tile.rtt[stack]) {
                    const obj = this.pool.getObjectForId(tile.rtt[stack].id);
                    if (obj.stamp === tile.rtt[stack].stamp) {
                        this.pool.useObject(obj);
                        continue;
                    }
                }
                const obj = this.pool.getOrCreateFreeObject();
                this.pool.useObject(obj);
                this.pool.stampObject(obj);
                tile.rtt[stack] = { id: obj.id, stamp: obj.stamp };
                painter.context.bindFramebuffer.set(obj.fbo.framebuffer);
                painter.context.clear({ color: Color.transparent, stencil: 0 });
                painter.currentStencilSource = undefined;
                for (let l = 0; l < layers.length; l++) {
                    const layer = painter.style._layers[layers[l]];
                    const coords = layer.source ? this._coordsAscending[layer.source][tile.tileID.key] : [tile.tileID];
                    painter.context.viewport.set([0, 0, obj.fbo.width, obj.fbo.height]);
                    painter._renderTileClippingMasks(layer, coords, true);
                    painter.renderLayer(painter, painter.style.sourceCaches[layer.source], layer, coords, options);
                    if (layer.source)
                        tile.rttCoords[layer.source] = this._coordsAscendingStr[layer.source][tile.tileID.key];
                }
            }
            drawTerrain(this.painter, this.terrain, this._rttTiles, options);
            this._rttTiles = [];
            this.pool.freeAllObjects();
            return LAYERS[type];
        }
        return false;
    }
}
//# sourceMappingURL=render_to_texture.js.map