var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { create as createSource } from './source';
import { Tile } from './tile';
import { Event, ErrorEvent, Evented } from '../util/evented';
import { TileCache } from './tile_cache';
import { MercatorCoordinate } from '../geo/mercator_coordinate';
import { keysDifference } from '../util/util';
import { EXTENT } from '../data/extent';
import Point from '@mapbox/point-geometry';
import { browser } from '../util/browser';
import { OverscaledTileID } from './tile_id';
import { SourceFeatureState } from './source_state';
import { config } from '../util/config';
import { coveringTiles, coveringZoomLevel } from '../geo/projection/covering_tiles';
import { Bounds } from '../geo/bounds';
import { EXTENT_BOUNDS } from '../data/extent_bounds';
export class SourceCache extends Evented {
    constructor(id, options, dispatcher) {
        super();
        this.id = id;
        this.dispatcher = dispatcher;
        this.on('data', (e) => this._dataHandler(e));
        this.on('dataloading', () => {
            this._sourceErrored = false;
        });
        this.on('error', () => {
            this._sourceErrored = this._source.loaded();
        });
        this._source = createSource(id, options, dispatcher, this);
        this._tiles = {};
        this._cache = new TileCache(0, (tile) => this._unloadTile(tile));
        this._timers = {};
        this._cacheTimers = {};
        this._maxTileCacheSize = null;
        this._maxTileCacheZoomLevels = null;
        this._loadedParentTiles = {};
        this._coveredTiles = {};
        this._state = new SourceFeatureState();
        this._didEmitContent = false;
        this._updated = false;
    }
    onAdd(map) {
        this.map = map;
        this._maxTileCacheSize = map ? map._maxTileCacheSize : null;
        this._maxTileCacheZoomLevels = map ? map._maxTileCacheZoomLevels : null;
        if (this._source && this._source.onAdd) {
            this._source.onAdd(map);
        }
    }
    onRemove(map) {
        this.clearTiles();
        if (this._source && this._source.onRemove) {
            this._source.onRemove(map);
        }
    }
    loaded() {
        if (this._sourceErrored) {
            return true;
        }
        if (!this._sourceLoaded) {
            return false;
        }
        if (!this._source.loaded()) {
            return false;
        }
        if ((this.used !== undefined || this.usedForTerrain !== undefined) && !this.used && !this.usedForTerrain) {
            return true;
        }
        if (!this._updated) {
            return false;
        }
        for (const t in this._tiles) {
            const tile = this._tiles[t];
            if (tile.state !== 'loaded' && tile.state !== 'errored')
                return false;
        }
        return true;
    }
    getSource() {
        return this._source;
    }
    pause() {
        this._paused = true;
    }
    resume() {
        if (!this._paused)
            return;
        const shouldReload = this._shouldReloadOnResume;
        this._paused = false;
        this._shouldReloadOnResume = false;
        if (shouldReload)
            this.reload();
        if (this.transform)
            this.update(this.transform, this.terrain);
    }
    _loadTile(tile, id, state) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield this._source.loadTile(tile);
                this._tileLoaded(tile, id, state);
            }
            catch (err) {
                tile.state = 'errored';
                if (err.status !== 404) {
                    this._source.fire(new ErrorEvent(err, { tile }));
                }
                else {
                    this.update(this.transform, this.terrain);
                }
            }
        });
    }
    _unloadTile(tile) {
        if (this._source.unloadTile)
            this._source.unloadTile(tile);
    }
    _abortTile(tile) {
        if (this._source.abortTile)
            this._source.abortTile(tile);
        this._source.fire(new Event('dataabort', { tile, coord: tile.tileID, dataType: 'source' }));
    }
    serialize() {
        return this._source.serialize();
    }
    prepare(context) {
        if (this._source.prepare) {
            this._source.prepare();
        }
        this._state.coalesceChanges(this._tiles, this.map ? this.map.painter : null);
        for (const i in this._tiles) {
            const tile = this._tiles[i];
            tile.upload(context);
            tile.prepare(this.map.style.imageManager);
        }
    }
    getIds() {
        return Object.values(this._tiles).map((tile) => tile.tileID).sort(compareTileId).map(id => id.key);
    }
    getRenderableIds(symbolLayer) {
        const renderables = [];
        for (const id in this._tiles) {
            if (this._isIdRenderable(id, symbolLayer))
                renderables.push(this._tiles[id]);
        }
        if (symbolLayer) {
            return renderables.sort((a_, b_) => {
                const a = a_.tileID;
                const b = b_.tileID;
                const rotatedA = (new Point(a.canonical.x, a.canonical.y))._rotate(-this.transform.bearingInRadians);
                const rotatedB = (new Point(b.canonical.x, b.canonical.y))._rotate(-this.transform.bearingInRadians);
                return a.overscaledZ - b.overscaledZ || rotatedB.y - rotatedA.y || rotatedB.x - rotatedA.x;
            }).map(tile => tile.tileID.key);
        }
        return renderables.map(tile => tile.tileID).sort(compareTileId).map(id => id.key);
    }
    hasRenderableParent(tileID) {
        const parentTile = this.findLoadedParent(tileID, 0);
        if (parentTile) {
            return this._isIdRenderable(parentTile.tileID.key);
        }
        return false;
    }
    _isIdRenderable(id, symbolLayer) {
        return this._tiles[id] && this._tiles[id].hasData() &&
            !this._coveredTiles[id] && (symbolLayer || !this._tiles[id].holdingForFade());
    }
    reload(sourceDataChanged) {
        if (this._paused) {
            this._shouldReloadOnResume = true;
            return;
        }
        this._cache.reset();
        for (const i in this._tiles) {
            if (sourceDataChanged) {
                this._reloadTile(i, 'expired');
            }
            else if (this._tiles[i].state !== 'errored') {
                this._reloadTile(i, 'reloading');
            }
        }
    }
    _reloadTile(id, state) {
        return __awaiter(this, void 0, void 0, function* () {
            const tile = this._tiles[id];
            if (!tile)
                return;
            if (tile.state !== 'loading') {
                tile.state = state;
            }
            yield this._loadTile(tile, id, state);
        });
    }
    _tileLoaded(tile, id, previousState) {
        tile.timeAdded = browser.now();
        if (previousState === 'expired')
            tile.refreshedUponExpiration = true;
        this._setTileReloadTimer(id, tile);
        if (this.getSource().type === 'raster-dem' && tile.dem)
            this._backfillDEM(tile);
        this._state.initializeTileState(tile, this.map ? this.map.painter : null);
        if (!tile.aborted) {
            this._source.fire(new Event('data', { dataType: 'source', tile, coord: tile.tileID }));
        }
    }
    _backfillDEM(tile) {
        const renderables = this.getRenderableIds();
        for (let i = 0; i < renderables.length; i++) {
            const borderId = renderables[i];
            if (tile.neighboringTiles && tile.neighboringTiles[borderId]) {
                const borderTile = this.getTileByID(borderId);
                fillBorder(tile, borderTile);
                fillBorder(borderTile, tile);
            }
        }
        function fillBorder(tile, borderTile) {
            tile.needsHillshadePrepare = true;
            tile.needsTerrainPrepare = true;
            let dx = borderTile.tileID.canonical.x - tile.tileID.canonical.x;
            const dy = borderTile.tileID.canonical.y - tile.tileID.canonical.y;
            const dim = Math.pow(2, tile.tileID.canonical.z);
            const borderId = borderTile.tileID.key;
            if (dx === 0 && dy === 0)
                return;
            if (Math.abs(dy) > 1) {
                return;
            }
            if (Math.abs(dx) > 1) {
                if (Math.abs(dx + dim) === 1) {
                    dx += dim;
                }
                else if (Math.abs(dx - dim) === 1) {
                    dx -= dim;
                }
            }
            if (!borderTile.dem || !tile.dem)
                return;
            tile.dem.backfillBorder(borderTile.dem, dx, dy);
            if (tile.neighboringTiles && tile.neighboringTiles[borderId])
                tile.neighboringTiles[borderId].backfilled = true;
        }
    }
    getTile(tileID) {
        return this.getTileByID(tileID.key);
    }
    getTileByID(id) {
        return this._tiles[id];
    }
    _retainLoadedChildren(idealTiles, zoom, maxCoveringZoom, retain) {
        for (const id in this._tiles) {
            let tile = this._tiles[id];
            if (retain[id] ||
                !tile.hasData() ||
                tile.tileID.overscaledZ <= zoom ||
                tile.tileID.overscaledZ > maxCoveringZoom)
                continue;
            let topmostLoadedID = tile.tileID;
            while (tile && tile.tileID.overscaledZ > zoom + 1) {
                const parentID = tile.tileID.scaledTo(tile.tileID.overscaledZ - 1);
                tile = this._tiles[parentID.key];
                if (tile && tile.hasData()) {
                    topmostLoadedID = parentID;
                }
            }
            let tileID = topmostLoadedID;
            while (tileID.overscaledZ > zoom) {
                tileID = tileID.scaledTo(tileID.overscaledZ - 1);
                if (idealTiles[tileID.key] || (idealTiles[tileID.canonical.key])) {
                    retain[topmostLoadedID.key] = topmostLoadedID;
                    break;
                }
            }
        }
    }
    findLoadedParent(tileID, minCoveringZoom) {
        if (tileID.key in this._loadedParentTiles) {
            const parent = this._loadedParentTiles[tileID.key];
            if (parent && parent.tileID.overscaledZ >= minCoveringZoom) {
                return parent;
            }
            else {
                return null;
            }
        }
        for (let z = tileID.overscaledZ - 1; z >= minCoveringZoom; z--) {
            const parentTileID = tileID.scaledTo(z);
            const tile = this._getLoadedTile(parentTileID);
            if (tile) {
                return tile;
            }
        }
    }
    findLoadedSibling(tileID) {
        return this._getLoadedTile(tileID);
    }
    _getLoadedTile(tileID) {
        const tile = this._tiles[tileID.key];
        if (tile && tile.hasData()) {
            return tile;
        }
        const cachedTile = this._cache.getByKey(tileID.wrapped().key);
        return cachedTile;
    }
    updateCacheSize(transform) {
        const widthInTiles = Math.ceil(transform.width / this._source.tileSize) + 1;
        const heightInTiles = Math.ceil(transform.height / this._source.tileSize) + 1;
        const approxTilesInView = widthInTiles * heightInTiles;
        const commonZoomRange = this._maxTileCacheZoomLevels === null ?
            config.MAX_TILE_CACHE_ZOOM_LEVELS : this._maxTileCacheZoomLevels;
        const viewDependentMaxSize = Math.floor(approxTilesInView * commonZoomRange);
        const maxSize = typeof this._maxTileCacheSize === 'number' ?
            Math.min(this._maxTileCacheSize, viewDependentMaxSize) : viewDependentMaxSize;
        this._cache.setMaxSize(maxSize);
    }
    handleWrapJump(lng) {
        const prevLng = this._prevLng === undefined ? lng : this._prevLng;
        const lngDifference = lng - prevLng;
        const worldDifference = lngDifference / 360;
        const wrapDelta = Math.round(worldDifference);
        this._prevLng = lng;
        if (wrapDelta) {
            const tiles = {};
            for (const key in this._tiles) {
                const tile = this._tiles[key];
                tile.tileID = tile.tileID.unwrapTo(tile.tileID.wrap + wrapDelta);
                tiles[tile.tileID.key] = tile;
            }
            this._tiles = tiles;
            for (const id in this._timers) {
                clearTimeout(this._timers[id]);
                delete this._timers[id];
            }
            for (const id in this._tiles) {
                const tile = this._tiles[id];
                this._setTileReloadTimer(id, tile);
            }
        }
    }
    _updateCoveredAndRetainedTiles(retain, minCoveringZoom, maxCoveringZoom, zoom, idealTileIDs, terrain) {
        const tilesForFading = {};
        const fadingTiles = {};
        const ids = Object.keys(retain);
        const now = browser.now();
        for (const id of ids) {
            const tileID = retain[id];
            const tile = this._tiles[id];
            if (!tile || (tile.fadeEndTime !== 0 && tile.fadeEndTime <= now)) {
                continue;
            }
            const parentTile = this.findLoadedParent(tileID, minCoveringZoom);
            const siblingTile = this.findLoadedSibling(tileID);
            const fadeTileRef = parentTile || siblingTile || null;
            if (fadeTileRef) {
                this._addTile(fadeTileRef.tileID);
                tilesForFading[fadeTileRef.tileID.key] = fadeTileRef.tileID;
            }
            fadingTiles[id] = tileID;
        }
        this._retainLoadedChildren(fadingTiles, zoom, maxCoveringZoom, retain);
        for (const id in tilesForFading) {
            if (!retain[id]) {
                this._coveredTiles[id] = true;
                retain[id] = tilesForFading[id];
            }
        }
        if (terrain) {
            const idealRasterTileIDs = {};
            const missingTileIDs = {};
            for (const tileID of idealTileIDs) {
                if (this._tiles[tileID.key].hasData())
                    idealRasterTileIDs[tileID.key] = tileID;
                else
                    missingTileIDs[tileID.key] = tileID;
            }
            for (const key in missingTileIDs) {
                const children = missingTileIDs[key].children(this._source.maxzoom);
                if (this._tiles[children[0].key] && this._tiles[children[1].key] && this._tiles[children[2].key] && this._tiles[children[3].key]) {
                    idealRasterTileIDs[children[0].key] = retain[children[0].key] = children[0];
                    idealRasterTileIDs[children[1].key] = retain[children[1].key] = children[1];
                    idealRasterTileIDs[children[2].key] = retain[children[2].key] = children[2];
                    idealRasterTileIDs[children[3].key] = retain[children[3].key] = children[3];
                    delete missingTileIDs[key];
                }
            }
            for (const key in missingTileIDs) {
                const tileID = missingTileIDs[key];
                const parentTile = this.findLoadedParent(tileID, this._source.minzoom);
                const siblingTile = this.findLoadedSibling(tileID);
                const fadeTileRef = parentTile || siblingTile || null;
                if (fadeTileRef) {
                    idealRasterTileIDs[fadeTileRef.tileID.key] = retain[fadeTileRef.tileID.key] = fadeTileRef.tileID;
                    for (const key in idealRasterTileIDs) {
                        if (idealRasterTileIDs[key].isChildOf(fadeTileRef.tileID))
                            delete idealRasterTileIDs[key];
                    }
                }
            }
            for (const key in this._tiles) {
                if (!idealRasterTileIDs[key])
                    this._coveredTiles[key] = true;
            }
        }
    }
    update(transform, terrain) {
        if (!this._sourceLoaded || this._paused) {
            return;
        }
        this.transform = transform;
        this.terrain = terrain;
        this.updateCacheSize(transform);
        this.handleWrapJump(this.transform.center.lng);
        this._coveredTiles = {};
        let idealTileIDs;
        if (!this.used && !this.usedForTerrain) {
            idealTileIDs = [];
        }
        else if (this._source.tileID) {
            idealTileIDs = transform.getVisibleUnwrappedCoordinates(this._source.tileID)
                .map((unwrapped) => new OverscaledTileID(unwrapped.canonical.z, unwrapped.wrap, unwrapped.canonical.z, unwrapped.canonical.x, unwrapped.canonical.y));
        }
        else {
            idealTileIDs = coveringTiles(transform, {
                tileSize: this.usedForTerrain ? this.tileSize : this._source.tileSize,
                minzoom: this._source.minzoom,
                maxzoom: this._source.maxzoom,
                roundZoom: this.usedForTerrain ? false : this._source.roundZoom,
                reparseOverscaled: this._source.reparseOverscaled,
                terrain,
                calculateTileZoom: this._source.calculateTileZoom
            });
            if (this._source.hasTile) {
                idealTileIDs = idealTileIDs.filter((coord) => this._source.hasTile(coord));
            }
        }
        const zoom = coveringZoomLevel(transform, this._source);
        const minCoveringZoom = Math.max(zoom - SourceCache.maxOverzooming, this._source.minzoom);
        const maxCoveringZoom = Math.max(zoom + SourceCache.maxUnderzooming, this._source.minzoom);
        if (this.usedForTerrain) {
            const parents = {};
            for (const tileID of idealTileIDs) {
                if (tileID.canonical.z > this._source.minzoom) {
                    const parent = tileID.scaledTo(tileID.canonical.z - 1);
                    parents[parent.key] = parent;
                    const parent2 = tileID.scaledTo(Math.max(this._source.minzoom, Math.min(tileID.canonical.z, 5)));
                    parents[parent2.key] = parent2;
                }
            }
            idealTileIDs = idealTileIDs.concat(Object.values(parents));
        }
        const noPendingDataEmissions = idealTileIDs.length === 0 && !this._updated && this._didEmitContent;
        this._updated = true;
        if (noPendingDataEmissions) {
            this.fire(new Event('data', { sourceDataType: 'idle', dataType: 'source', sourceId: this.id }));
        }
        const retain = this._updateRetainedTiles(idealTileIDs, zoom);
        if (isRasterType(this._source.type)) {
            this._updateCoveredAndRetainedTiles(retain, minCoveringZoom, maxCoveringZoom, zoom, idealTileIDs, terrain);
        }
        for (const retainedId in retain) {
            this._tiles[retainedId].clearFadeHold();
        }
        const remove = keysDifference(this._tiles, retain);
        for (const tileID of remove) {
            const tile = this._tiles[tileID];
            if (tile.hasSymbolBuckets && !tile.holdingForFade()) {
                tile.setHoldDuration(this.map._fadeDuration);
            }
            else if (!tile.hasSymbolBuckets || tile.symbolFadeFinished()) {
                this._removeTile(tileID);
            }
        }
        this._updateLoadedParentTileCache();
        this._updateLoadedSiblingTileCache();
    }
    releaseSymbolFadeTiles() {
        for (const id in this._tiles) {
            if (this._tiles[id].holdingForFade()) {
                this._removeTile(id);
            }
        }
    }
    _updateRetainedTiles(idealTileIDs, zoom) {
        var _a;
        const retain = {};
        const checked = {};
        const minCoveringZoom = Math.max(zoom - SourceCache.maxOverzooming, this._source.minzoom);
        const maxCoveringZoom = Math.max(zoom + SourceCache.maxUnderzooming, this._source.minzoom);
        const missingTiles = {};
        for (const tileID of idealTileIDs) {
            const tile = this._addTile(tileID);
            retain[tileID.key] = tileID;
            if (tile.hasData())
                continue;
            if (zoom < this._source.maxzoom) {
                missingTiles[tileID.key] = tileID;
            }
        }
        this._retainLoadedChildren(missingTiles, zoom, maxCoveringZoom, retain);
        for (const tileID of idealTileIDs) {
            let tile = this._tiles[tileID.key];
            if (tile.hasData())
                continue;
            if (zoom + 1 > this._source.maxzoom) {
                const childCoord = tileID.children(this._source.maxzoom)[0];
                const childTile = this.getTile(childCoord);
                if (!!childTile && childTile.hasData()) {
                    retain[childCoord.key] = childCoord;
                    continue;
                }
            }
            else {
                const children = tileID.children(this._source.maxzoom);
                if (children.length === 4 &&
                    retain[children[0].key] &&
                    retain[children[1].key] &&
                    retain[children[2].key] &&
                    retain[children[3].key])
                    continue;
                if (children.length === 1 &&
                    retain[children[0].key])
                    continue;
            }
            let parentWasRequested = tile.wasRequested();
            for (let overscaledZ = tileID.overscaledZ - 1; overscaledZ >= minCoveringZoom; --overscaledZ) {
                const parentId = tileID.scaledTo(overscaledZ);
                if (checked[parentId.key])
                    break;
                checked[parentId.key] = true;
                tile = this.getTile(parentId);
                if (!tile && parentWasRequested) {
                    tile = this._addTile(parentId);
                }
                if (tile) {
                    const hasData = tile.hasData();
                    if (hasData || !((_a = this.map) === null || _a === void 0 ? void 0 : _a.cancelPendingTileRequestsWhileZooming) || parentWasRequested) {
                        retain[parentId.key] = parentId;
                    }
                    parentWasRequested = tile.wasRequested();
                    if (hasData)
                        break;
                }
            }
        }
        return retain;
    }
    _updateLoadedParentTileCache() {
        this._loadedParentTiles = {};
        for (const tileKey in this._tiles) {
            const path = [];
            let parentTile;
            let currentId = this._tiles[tileKey].tileID;
            while (currentId.overscaledZ > 0) {
                if (currentId.key in this._loadedParentTiles) {
                    parentTile = this._loadedParentTiles[currentId.key];
                    break;
                }
                path.push(currentId.key);
                const parentId = currentId.scaledTo(currentId.overscaledZ - 1);
                parentTile = this._getLoadedTile(parentId);
                if (parentTile) {
                    break;
                }
                currentId = parentId;
            }
            for (const key of path) {
                this._loadedParentTiles[key] = parentTile;
            }
        }
    }
    _updateLoadedSiblingTileCache() {
        this._loadedSiblingTiles = {};
        for (const tileKey in this._tiles) {
            const currentId = this._tiles[tileKey].tileID;
            const siblingTile = this._getLoadedTile(currentId);
            this._loadedSiblingTiles[currentId.key] = siblingTile;
        }
    }
    _addTile(tileID) {
        let tile = this._tiles[tileID.key];
        if (tile)
            return tile;
        tile = this._cache.getAndRemove(tileID);
        if (tile) {
            this._setTileReloadTimer(tileID.key, tile);
            tile.tileID = tileID;
            this._state.initializeTileState(tile, this.map ? this.map.painter : null);
            if (this._cacheTimers[tileID.key]) {
                clearTimeout(this._cacheTimers[tileID.key]);
                delete this._cacheTimers[tileID.key];
                this._setTileReloadTimer(tileID.key, tile);
            }
        }
        const cached = tile;
        if (!tile) {
            tile = new Tile(tileID, this._source.tileSize * tileID.overscaleFactor());
            this._loadTile(tile, tileID.key, tile.state);
        }
        tile.uses++;
        this._tiles[tileID.key] = tile;
        if (!cached) {
            this._source.fire(new Event('dataloading', { tile, coord: tile.tileID, dataType: 'source' }));
        }
        return tile;
    }
    _setTileReloadTimer(id, tile) {
        if (id in this._timers) {
            clearTimeout(this._timers[id]);
            delete this._timers[id];
        }
        const expiryTimeout = tile.getExpiryTimeout();
        if (expiryTimeout) {
            this._timers[id] = setTimeout(() => {
                this._reloadTile(id, 'expired');
                delete this._timers[id];
            }, expiryTimeout);
        }
    }
    refreshTiles(tileIds) {
        for (const id in this._tiles) {
            if (!this._isIdRenderable(id) && this._tiles[id].state != 'errored') {
                continue;
            }
            if (tileIds.some(tid => tid.equals(this._tiles[id].tileID.canonical))) {
                this._reloadTile(id, 'expired');
            }
        }
    }
    _removeTile(id) {
        const tile = this._tiles[id];
        if (!tile)
            return;
        tile.uses--;
        delete this._tiles[id];
        if (this._timers[id]) {
            clearTimeout(this._timers[id]);
            delete this._timers[id];
        }
        if (tile.uses > 0)
            return;
        if (tile.hasData() && tile.state !== 'reloading') {
            this._cache.add(tile.tileID, tile, tile.getExpiryTimeout());
        }
        else {
            tile.aborted = true;
            this._abortTile(tile);
            this._unloadTile(tile);
        }
    }
    _dataHandler(e) {
        const eventSourceDataType = e.sourceDataType;
        if (e.dataType === 'source' && eventSourceDataType === 'metadata') {
            this._sourceLoaded = true;
        }
        if (this._sourceLoaded && !this._paused && e.dataType === 'source' && eventSourceDataType === 'content') {
            this.reload(e.sourceDataChanged);
            if (this.transform) {
                this.update(this.transform, this.terrain);
            }
            this._didEmitContent = true;
        }
    }
    clearTiles() {
        this._shouldReloadOnResume = false;
        this._paused = false;
        for (const id in this._tiles)
            this._removeTile(id);
        this._cache.reset();
    }
    tilesIn(pointQueryGeometry, maxPitchScaleFactor, has3DLayer) {
        const tileResults = [];
        const transform = this.transform;
        if (!transform)
            return tileResults;
        const allowWorldCopies = transform.getCoveringTilesDetailsProvider().allowWorldCopies();
        const cameraPointQueryGeometry = has3DLayer ?
            transform.getCameraQueryGeometry(pointQueryGeometry) :
            pointQueryGeometry;
        const project = (point) => transform.screenPointToMercatorCoordinate(point, this.terrain);
        const queryGeometry = this.transformBbox(pointQueryGeometry, project, !allowWorldCopies);
        const cameraQueryGeometry = this.transformBbox(cameraPointQueryGeometry, project, !allowWorldCopies);
        const ids = this.getIds();
        const cameraBounds = Bounds.fromPoints(cameraQueryGeometry);
        for (let i = 0; i < ids.length; i++) {
            const tile = this._tiles[ids[i]];
            if (tile.holdingForFade()) {
                continue;
            }
            const tileIDs = allowWorldCopies ? [tile.tileID] : [tile.tileID.unwrapTo(-1), tile.tileID.unwrapTo(0)];
            const scale = Math.pow(2, transform.zoom - tile.tileID.overscaledZ);
            const queryPadding = maxPitchScaleFactor * tile.queryPadding * EXTENT / tile.tileSize / scale;
            for (const tileID of tileIDs) {
                const tileSpaceBounds = cameraBounds.map(point => tileID.getTilePoint(new MercatorCoordinate(point.x, point.y)));
                tileSpaceBounds.expandBy(queryPadding);
                if (tileSpaceBounds.intersects(EXTENT_BOUNDS)) {
                    const tileSpaceQueryGeometry = queryGeometry.map((c) => tileID.getTilePoint(c));
                    const tileSpaceCameraQueryGeometry = cameraQueryGeometry.map((c) => tileID.getTilePoint(c));
                    tileResults.push({
                        tile,
                        tileID: allowWorldCopies ? tileID : tileID.unwrapTo(0),
                        queryGeometry: tileSpaceQueryGeometry,
                        cameraQueryGeometry: tileSpaceCameraQueryGeometry,
                        scale
                    });
                }
            }
        }
        return tileResults;
    }
    transformBbox(geom, project, checkWrap) {
        let transformed = geom.map(project);
        if (checkWrap) {
            const bounds = Bounds.fromPoints(geom);
            bounds.shrinkBy(Math.min(bounds.width(), bounds.height()) * 0.001);
            const projected = bounds.map(project);
            const newBounds = Bounds.fromPoints(transformed);
            if (!newBounds.covers(projected)) {
                transformed = transformed.map((coord) => coord.x > 0.5 ?
                    new MercatorCoordinate(coord.x - 1, coord.y, coord.z) :
                    coord);
            }
        }
        return transformed;
    }
    getVisibleCoordinates(symbolLayer) {
        const coords = this.getRenderableIds(symbolLayer).map((id) => this._tiles[id].tileID);
        if (this.transform) {
            this.transform.populateCache(coords);
        }
        return coords;
    }
    hasTransition() {
        if (this._source.hasTransition()) {
            return true;
        }
        if (isRasterType(this._source.type)) {
            const now = browser.now();
            for (const id in this._tiles) {
                const tile = this._tiles[id];
                if (tile.fadeEndTime >= now) {
                    return true;
                }
            }
        }
        return false;
    }
    setFeatureState(sourceLayer, featureId, state) {
        sourceLayer = sourceLayer || '_geojsonTileLayer';
        this._state.updateState(sourceLayer, featureId, state);
    }
    removeFeatureState(sourceLayer, featureId, key) {
        sourceLayer = sourceLayer || '_geojsonTileLayer';
        this._state.removeFeatureState(sourceLayer, featureId, key);
    }
    getFeatureState(sourceLayer, featureId) {
        sourceLayer = sourceLayer || '_geojsonTileLayer';
        return this._state.getState(sourceLayer, featureId);
    }
    setDependencies(tileKey, namespace, dependencies) {
        const tile = this._tiles[tileKey];
        if (tile) {
            tile.setDependencies(namespace, dependencies);
        }
    }
    reloadTilesForDependencies(namespaces, keys) {
        for (const id in this._tiles) {
            const tile = this._tiles[id];
            if (tile.hasDependency(namespaces, keys)) {
                this._reloadTile(id, 'reloading');
            }
        }
        this._cache.filter(tile => !tile.hasDependency(namespaces, keys));
    }
}
SourceCache.maxOverzooming = 10;
SourceCache.maxUnderzooming = 3;
function compareTileId(a, b) {
    const aWrap = Math.abs(a.wrap * 2) - +(a.wrap < 0);
    const bWrap = Math.abs(b.wrap * 2) - +(b.wrap < 0);
    return a.overscaledZ - b.overscaledZ || bWrap - aWrap || b.canonical.y - a.canonical.y || b.canonical.x - a.canonical.x;
}
function isRasterType(type) {
    return type === 'raster' || type === 'image' || type === 'video';
}
//# sourceMappingURL=source_cache.js.map