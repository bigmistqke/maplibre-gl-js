var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { Event, ErrorEvent, Evented } from '../util/evented';
import { createStyleLayer } from './create_style_layer';
import { loadSprite } from './load_sprite';
import { ImageManager } from '../render/image_manager';
import { GlyphManager } from '../render/glyph_manager';
import { Light } from './light';
import { Sky } from './sky';
import { LineAtlas } from '../render/line_atlas';
import { clone, extend, deepEqual, filterObject, mapObject } from '../util/util';
import { coerceSpriteToArray } from '../util/style';
import { getJSON, getReferrer } from '../util/ajax';
import { browser } from '../util/browser';
import { Dispatcher } from '../util/dispatcher';
import { validateStyle, emitValidationErrors as _emitValidationErrors } from './validate_style';
import { queryRenderedFeatures, queryRenderedSymbols, querySourceFeatures } from '../source/query_features';
import { SourceCache } from '../source/source_cache';
import { latest as styleSpec, derefLayers, emptyStyle, diff as diffStyles } from '@maplibre/maplibre-gl-style-spec';
import { getGlobalWorkerPool } from '../util/global_worker_pool';
import { rtlMainThreadPluginFactory } from '../source/rtl_text_plugin_main_thread';
import { RTLPluginLoadedEventName } from '../source/rtl_text_plugin_status';
import { PauseablePlacement } from './pauseable_placement';
import { ZoomHistory } from './zoom_history';
import { CrossTileSymbolIndex } from '../symbol/cross_tile_symbol_index';
import { validateCustomStyleLayer } from './style_layer/custom_style_layer';
const emitValidationErrors = (evented, errors) => _emitValidationErrors(evented, errors && errors.filter(error => error.identifier !== 'source.canvas'));
import { createProjectionFromName } from '../geo/projection/projection_factory';
const empty = emptyStyle();
export class Style extends Evented {
    constructor(map, options = {}) {
        var _a, _b;
        super();
        this._rtlPluginLoaded = () => {
            for (const id in this.sourceCaches) {
                const sourceType = this.sourceCaches[id].getSource().type;
                if (sourceType === 'vector' || sourceType === 'geojson') {
                    this.sourceCaches[id].reload();
                }
            }
        };
        this.map = map;
        this.dispatcher = new Dispatcher(getGlobalWorkerPool(), map._getMapId());
        this.dispatcher.registerMessageHandler("GG", (mapId, params) => {
            return this.getGlyphs(mapId, params);
        });
        this.dispatcher.registerMessageHandler("GI", (mapId, params) => {
            return this.getImages(mapId, params);
        });
        this.imageManager = new ImageManager();
        this.imageManager.setEventedParent(this);
        const glyphLang = ((_a = map._container) === null || _a === void 0 ? void 0 : _a.lang) || (typeof document !== 'undefined' && ((_b = document.documentElement) === null || _b === void 0 ? void 0 : _b.lang)) || undefined;
        this.glyphManager = new GlyphManager(map._requestManager, options.localIdeographFontFamily, glyphLang);
        this.lineAtlas = new LineAtlas(256, 512);
        this.crossTileSymbolIndex = new CrossTileSymbolIndex();
        this._spritesImagesIds = {};
        this._layers = {};
        this._order = [];
        this.sourceCaches = {};
        this.zoomHistory = new ZoomHistory();
        this._loaded = false;
        this._availableImages = [];
        this._globalState = {};
        this._resetUpdates();
        this.dispatcher.broadcast("SR", getReferrer());
        rtlMainThreadPluginFactory().on(RTLPluginLoadedEventName, this._rtlPluginLoaded);
        this.on('data', (event) => {
            if (event.dataType !== 'source' || event.sourceDataType !== 'metadata') {
                return;
            }
            const sourceCache = this.sourceCaches[event.sourceId];
            if (!sourceCache) {
                return;
            }
            const source = sourceCache.getSource();
            if (!source || !source.vectorLayerIds) {
                return;
            }
            for (const layerId in this._layers) {
                const layer = this._layers[layerId];
                if (layer.source === source.id) {
                    this._validateLayer(layer);
                }
            }
        });
    }
    setGlobalStateProperty(name, value) {
        var _a, _b, _c;
        this._checkLoaded();
        const newValue = value === null ?
            (_c = (_b = (_a = this.stylesheet.state) === null || _a === void 0 ? void 0 : _a[name]) === null || _b === void 0 ? void 0 : _b.default) !== null && _c !== void 0 ? _c : null :
            value;
        if (deepEqual(newValue, this._globalState[name])) {
            return this;
        }
        this._globalState[name] = newValue;
        this._applyGlobalStateChanges([name]);
    }
    getGlobalState() {
        return this._globalState;
    }
    setGlobalState(newStylesheetState) {
        this._checkLoaded();
        const changedGlobalStateRefs = [];
        for (const propertyName in newStylesheetState) {
            const didChange = !deepEqual(this._globalState[propertyName], newStylesheetState[propertyName].default);
            if (didChange) {
                changedGlobalStateRefs.push(propertyName);
                this._globalState[propertyName] = newStylesheetState[propertyName].default;
            }
        }
        this._applyGlobalStateChanges(changedGlobalStateRefs);
    }
    _applyGlobalStateChanges(globalStateRefs) {
        if (globalStateRefs.length === 0) {
            return;
        }
        const sourceIdsToReload = new Set();
        const globalStateChange = {};
        for (const ref of globalStateRefs) {
            globalStateChange[ref] = this._globalState[ref];
            for (const layerId in this._layers) {
                const layer = this._layers[layerId];
                const layoutAffectingGlobalStateRefs = layer.getLayoutAffectingGlobalStateRefs();
                const paintAffectingGlobalStateRefs = layer.getPaintAffectingGlobalStateRefs();
                if (layoutAffectingGlobalStateRefs.has(ref)) {
                    sourceIdsToReload.add(layer.source);
                }
                if (paintAffectingGlobalStateRefs.has(ref)) {
                    for (const { name, value } of paintAffectingGlobalStateRefs.get(ref)) {
                        this._updatePaintProperty(layer, name, value);
                    }
                }
            }
        }
        this.dispatcher.broadcast("UGS", globalStateChange);
        for (const id in this.sourceCaches) {
            if (sourceIdsToReload.has(id)) {
                this._reloadSource(id);
                this._changed = true;
            }
        }
    }
    loadURL(url, options = {}, previousStyle) {
        this.fire(new Event('dataloading', { dataType: 'style' }));
        options.validate = typeof options.validate === 'boolean' ?
            options.validate : true;
        const request = this.map._requestManager.transformRequest(url, "Style");
        this._loadStyleRequest = new AbortController();
        const abortController = this._loadStyleRequest;
        getJSON(request, this._loadStyleRequest).then((response) => {
            this._loadStyleRequest = null;
            this._load(response.data, options, previousStyle);
        }).catch((error) => {
            this._loadStyleRequest = null;
            if (error && !abortController.signal.aborted) {
                this.fire(new ErrorEvent(error));
            }
        });
    }
    loadJSON(json, options = {}, previousStyle) {
        this.fire(new Event('dataloading', { dataType: 'style' }));
        this._frameRequest = new AbortController();
        browser.frameAsync(this._frameRequest).then(() => {
            this._frameRequest = null;
            options.validate = options.validate !== false;
            this._load(json, options, previousStyle);
        }).catch(() => { });
    }
    loadEmpty() {
        this.fire(new Event('dataloading', { dataType: 'style' }));
        this._load(empty, { validate: false });
    }
    _load(json, options, previousStyle) {
        var _a, _b;
        let nextState = options.transformStyle ? options.transformStyle(previousStyle, json) : json;
        if (options.validate && emitValidationErrors(this, validateStyle(nextState))) {
            return;
        }
        nextState = Object.assign({}, nextState);
        this._loaded = true;
        this.stylesheet = nextState;
        for (const id in nextState.sources) {
            this.addSource(id, nextState.sources[id], { validate: false });
        }
        if (nextState.sprite) {
            this._loadSprite(nextState.sprite);
        }
        else {
            this.imageManager.setLoaded(true);
        }
        this.glyphManager.setURL(nextState.glyphs);
        this._createLayers();
        this.light = new Light(this.stylesheet.light);
        this._setProjectionInternal(((_a = this.stylesheet.projection) === null || _a === void 0 ? void 0 : _a.type) || 'mercator');
        this.sky = new Sky(this.stylesheet.sky);
        this.map.setTerrain((_b = this.stylesheet.terrain) !== null && _b !== void 0 ? _b : null);
        this.fire(new Event('data', { dataType: 'style' }));
        this.fire(new Event('style.load'));
    }
    _createLayers() {
        var _a;
        const dereferencedLayers = derefLayers(this.stylesheet.layers);
        this.setGlobalState((_a = this.stylesheet.state) !== null && _a !== void 0 ? _a : null);
        this.dispatcher.broadcast("SL", dereferencedLayers);
        this._order = dereferencedLayers.map((layer) => layer.id);
        this._layers = {};
        this._serializedLayers = null;
        for (const layer of dereferencedLayers) {
            const styledLayer = createStyleLayer(layer, this._globalState);
            styledLayer.setEventedParent(this, { layer: { id: layer.id } });
            this._layers[layer.id] = styledLayer;
        }
    }
    _loadSprite(sprite, isUpdate = false, completion = undefined) {
        this.imageManager.setLoaded(false);
        this._spriteRequest = new AbortController();
        let err;
        loadSprite(sprite, this.map._requestManager, this.map.getPixelRatio(), this._spriteRequest).then((images) => {
            this._spriteRequest = null;
            if (images) {
                for (const spriteId in images) {
                    this._spritesImagesIds[spriteId] = [];
                    const imagesToRemove = this._spritesImagesIds[spriteId] ? this._spritesImagesIds[spriteId].filter(id => !(id in images)) : [];
                    for (const id of imagesToRemove) {
                        this.imageManager.removeImage(id);
                        this._changedImages[id] = true;
                    }
                    for (const id in images[spriteId]) {
                        const imageId = spriteId === 'default' ? id : `${spriteId}:${id}`;
                        this._spritesImagesIds[spriteId].push(imageId);
                        if (imageId in this.imageManager.images) {
                            this.imageManager.updateImage(imageId, images[spriteId][id], false);
                        }
                        else {
                            this.imageManager.addImage(imageId, images[spriteId][id]);
                        }
                        if (isUpdate) {
                            this._changedImages[imageId] = true;
                        }
                    }
                }
            }
        }).catch((error) => {
            this._spriteRequest = null;
            err = error;
            this.fire(new ErrorEvent(err));
        }).finally(() => {
            this.imageManager.setLoaded(true);
            this._availableImages = this.imageManager.listImages();
            if (isUpdate) {
                this._changed = true;
            }
            this.dispatcher.broadcast("SI", this._availableImages);
            this.fire(new Event('data', { dataType: 'style' }));
            if (completion) {
                completion(err);
            }
        });
    }
    _unloadSprite() {
        for (const id of Object.values(this._spritesImagesIds).flat()) {
            this.imageManager.removeImage(id);
            this._changedImages[id] = true;
        }
        this._spritesImagesIds = {};
        this._availableImages = this.imageManager.listImages();
        this._changed = true;
        this.dispatcher.broadcast("SI", this._availableImages);
        this.fire(new Event('data', { dataType: 'style' }));
    }
    _validateLayer(layer) {
        const sourceCache = this.sourceCaches[layer.source];
        if (!sourceCache) {
            return;
        }
        const sourceLayer = layer.sourceLayer;
        if (!sourceLayer) {
            return;
        }
        const source = sourceCache.getSource();
        if (source.type === 'geojson' || (source.vectorLayerIds && source.vectorLayerIds.indexOf(sourceLayer) === -1)) {
            this.fire(new ErrorEvent(new Error(`Source layer "${sourceLayer}" ` +
                `does not exist on source "${source.id}" ` +
                `as specified by style layer "${layer.id}".`)));
        }
    }
    loaded() {
        if (!this._loaded)
            return false;
        if (Object.keys(this._updatedSources).length)
            return false;
        for (const id in this.sourceCaches)
            if (!this.sourceCaches[id].loaded())
                return false;
        if (!this.imageManager.isLoaded())
            return false;
        return true;
    }
    _serializeByIds(ids, returnClone = false) {
        const serializedLayersDictionary = this._serializedAllLayers();
        if (!ids || ids.length === 0) {
            return returnClone ? Object.values(clone(serializedLayersDictionary)) : Object.values(serializedLayersDictionary);
        }
        const serializedLayers = [];
        for (const id of ids) {
            if (serializedLayersDictionary[id]) {
                const toPush = returnClone ? clone(serializedLayersDictionary[id]) : serializedLayersDictionary[id];
                serializedLayers.push(toPush);
            }
        }
        return serializedLayers;
    }
    _serializedAllLayers() {
        let serializedLayers = this._serializedLayers;
        if (serializedLayers) {
            return serializedLayers;
        }
        serializedLayers = this._serializedLayers = {};
        const allLayerIds = Object.keys(this._layers);
        for (const layerId of allLayerIds) {
            const layer = this._layers[layerId];
            if (layer.type !== 'custom') {
                serializedLayers[layerId] = layer.serialize();
            }
        }
        return serializedLayers;
    }
    hasTransitions() {
        var _a, _b, _c;
        if ((_a = this.light) === null || _a === void 0 ? void 0 : _a.hasTransition()) {
            return true;
        }
        if ((_b = this.sky) === null || _b === void 0 ? void 0 : _b.hasTransition()) {
            return true;
        }
        if ((_c = this.projection) === null || _c === void 0 ? void 0 : _c.hasTransition()) {
            return true;
        }
        for (const id in this.sourceCaches) {
            if (this.sourceCaches[id].hasTransition()) {
                return true;
            }
        }
        for (const id in this._layers) {
            if (this._layers[id].hasTransition()) {
                return true;
            }
        }
        return false;
    }
    _checkLoaded() {
        if (!this._loaded) {
            throw new Error('Style is not done loading.');
        }
    }
    update(parameters) {
        if (!this._loaded) {
            return;
        }
        const changed = this._changed;
        if (changed) {
            const updatedIds = Object.keys(this._updatedLayers);
            const removedIds = Object.keys(this._removedLayers);
            if (updatedIds.length || removedIds.length) {
                this._updateWorkerLayers(updatedIds, removedIds);
            }
            for (const id in this._updatedSources) {
                const action = this._updatedSources[id];
                if (action === 'reload') {
                    this._reloadSource(id);
                }
                else if (action === 'clear') {
                    this._clearSource(id);
                }
                else {
                    throw new Error(`Invalid action ${action}`);
                }
            }
            this._updateTilesForChangedImages();
            this._updateTilesForChangedGlyphs();
            for (const id in this._updatedPaintProps) {
                this._layers[id].updateTransitions(parameters);
            }
            this.light.updateTransitions(parameters);
            this.sky.updateTransitions(parameters);
            this._resetUpdates();
        }
        const sourcesUsedBefore = {};
        for (const sourceCacheId in this.sourceCaches) {
            const sourceCache = this.sourceCaches[sourceCacheId];
            sourcesUsedBefore[sourceCacheId] = sourceCache.used;
            sourceCache.used = false;
        }
        for (const layerId of this._order) {
            const layer = this._layers[layerId];
            layer.recalculate(parameters, this._availableImages);
            if (!layer.isHidden(parameters.zoom) && layer.source) {
                this.sourceCaches[layer.source].used = true;
            }
        }
        for (const sourcesUsedBeforeId in sourcesUsedBefore) {
            const sourceCache = this.sourceCaches[sourcesUsedBeforeId];
            if (!!sourcesUsedBefore[sourcesUsedBeforeId] !== !!sourceCache.used) {
                sourceCache.fire(new Event('data', {
                    sourceDataType: 'visibility',
                    dataType: 'source',
                    sourceId: sourcesUsedBeforeId
                }));
            }
        }
        this.light.recalculate(parameters);
        this.sky.recalculate(parameters);
        this.projection.recalculate(parameters);
        this.z = parameters.zoom;
        if (changed) {
            this.fire(new Event('data', { dataType: 'style' }));
        }
    }
    _updateTilesForChangedImages() {
        const changedImages = Object.keys(this._changedImages);
        if (changedImages.length) {
            for (const name in this.sourceCaches) {
                this.sourceCaches[name].reloadTilesForDependencies(['icons', 'patterns'], changedImages);
            }
            this._changedImages = {};
        }
    }
    _updateTilesForChangedGlyphs() {
        if (this._glyphsDidChange) {
            for (const name in this.sourceCaches) {
                this.sourceCaches[name].reloadTilesForDependencies(['glyphs'], ['']);
            }
            this._glyphsDidChange = false;
        }
    }
    _updateWorkerLayers(updatedIds, removedIds) {
        this.dispatcher.broadcast("UL", {
            layers: this._serializeByIds(updatedIds, false),
            removedIds
        });
    }
    _resetUpdates() {
        this._changed = false;
        this._updatedLayers = {};
        this._removedLayers = {};
        this._updatedSources = {};
        this._updatedPaintProps = {};
        this._changedImages = {};
        this._glyphsDidChange = false;
    }
    setState(nextState, options = {}) {
        var _a;
        this._checkLoaded();
        const serializedStyle = this.serialize();
        nextState = options.transformStyle ? options.transformStyle(serializedStyle, nextState) : nextState;
        const validate = (_a = options.validate) !== null && _a !== void 0 ? _a : true;
        if (validate && emitValidationErrors(this, validateStyle(nextState)))
            return false;
        nextState = clone(nextState);
        nextState.layers = derefLayers(nextState.layers);
        const changes = diffStyles(serializedStyle, nextState);
        const operations = this._getOperationsToPerform(changes);
        if (operations.unimplemented.length > 0) {
            throw new Error(`Unimplemented: ${operations.unimplemented.join(', ')}.`);
        }
        if (operations.operations.length === 0) {
            return false;
        }
        for (const styleChangeOperation of operations.operations) {
            styleChangeOperation();
        }
        this.stylesheet = nextState;
        this._serializedLayers = null;
        return true;
    }
    _getOperationsToPerform(diff) {
        const operations = [];
        const unimplemented = [];
        for (const op of diff) {
            switch (op.command) {
                case 'setCenter':
                case 'setZoom':
                case 'setBearing':
                case 'setPitch':
                case 'setRoll':
                    continue;
                case 'addLayer':
                    operations.push(() => this.addLayer.apply(this, op.args));
                    break;
                case 'removeLayer':
                    operations.push(() => this.removeLayer.apply(this, op.args));
                    break;
                case 'setPaintProperty':
                    operations.push(() => this.setPaintProperty.apply(this, op.args));
                    break;
                case 'setLayoutProperty':
                    operations.push(() => this.setLayoutProperty.apply(this, op.args));
                    break;
                case 'setFilter':
                    operations.push(() => this.setFilter.apply(this, op.args));
                    break;
                case 'addSource':
                    operations.push(() => this.addSource.apply(this, op.args));
                    break;
                case 'removeSource':
                    operations.push(() => this.removeSource.apply(this, op.args));
                    break;
                case 'setLayerZoomRange':
                    operations.push(() => this.setLayerZoomRange.apply(this, op.args));
                    break;
                case 'setLight':
                    operations.push(() => this.setLight.apply(this, op.args));
                    break;
                case 'setGeoJSONSourceData':
                    operations.push(() => this.setGeoJSONSourceData.apply(this, op.args));
                    break;
                case 'setGlyphs':
                    operations.push(() => this.setGlyphs.apply(this, op.args));
                    break;
                case 'setSprite':
                    operations.push(() => this.setSprite.apply(this, op.args));
                    break;
                case 'setTerrain':
                    operations.push(() => this.map.setTerrain.apply(this, op.args));
                    break;
                case 'setSky':
                    operations.push(() => this.setSky.apply(this, op.args));
                    break;
                case 'setProjection':
                    this.setProjection.apply(this, op.args);
                    break;
                case 'setGlobalState':
                    operations.push(() => this.setGlobalState.apply(this, op.args));
                    break;
                case 'setTransition':
                    operations.push(() => { });
                    break;
                default:
                    unimplemented.push(op.command);
                    break;
            }
        }
        return {
            operations,
            unimplemented
        };
    }
    addImage(id, image) {
        if (this.getImage(id)) {
            return this.fire(new ErrorEvent(new Error(`An image named "${id}" already exists.`)));
        }
        this.imageManager.addImage(id, image);
        this._afterImageUpdated(id);
    }
    updateImage(id, image) {
        this.imageManager.updateImage(id, image);
    }
    getImage(id) {
        return this.imageManager.getImage(id);
    }
    removeImage(id) {
        if (!this.getImage(id)) {
            return this.fire(new ErrorEvent(new Error(`An image named "${id}" does not exist.`)));
        }
        this.imageManager.removeImage(id);
        this._afterImageUpdated(id);
    }
    _afterImageUpdated(id) {
        this._availableImages = this.imageManager.listImages();
        this._changedImages[id] = true;
        this._changed = true;
        this.dispatcher.broadcast("SI", this._availableImages);
        this.fire(new Event('data', { dataType: 'style' }));
    }
    listImages() {
        this._checkLoaded();
        return this.imageManager.listImages();
    }
    addSource(id, source, options = {}) {
        this._checkLoaded();
        if (this.sourceCaches[id] !== undefined) {
            throw new Error(`Source "${id}" already exists.`);
        }
        if (!source.type) {
            throw new Error(`The type property must be defined, but only the following properties were given: ${Object.keys(source).join(', ')}.`);
        }
        const builtIns = ['vector', 'raster', 'geojson', 'video', 'image'];
        const shouldValidate = builtIns.indexOf(source.type) >= 0;
        if (shouldValidate && this._validate(validateStyle.source, `sources.${id}`, source, null, options))
            return;
        if (this.map && this.map._collectResourceTiming)
            source.collectResourceTiming = true;
        const sourceCache = this.sourceCaches[id] = new SourceCache(id, source, this.dispatcher);
        sourceCache.style = this;
        sourceCache.setEventedParent(this, () => ({
            isSourceLoaded: sourceCache.loaded(),
            source: sourceCache.serialize(),
            sourceId: id
        }));
        sourceCache.onAdd(this.map);
        this._changed = true;
    }
    removeSource(id) {
        this._checkLoaded();
        if (this.sourceCaches[id] === undefined) {
            throw new Error('There is no source with this ID');
        }
        for (const layerId in this._layers) {
            if (this._layers[layerId].source === id) {
                return this.fire(new ErrorEvent(new Error(`Source "${id}" cannot be removed while layer "${layerId}" is using it.`)));
            }
        }
        const sourceCache = this.sourceCaches[id];
        delete this.sourceCaches[id];
        delete this._updatedSources[id];
        sourceCache.fire(new Event('data', { sourceDataType: 'metadata', dataType: 'source', sourceId: id }));
        sourceCache.setEventedParent(null);
        sourceCache.onRemove(this.map);
        this._changed = true;
    }
    setGeoJSONSourceData(id, data) {
        this._checkLoaded();
        if (this.sourceCaches[id] === undefined)
            throw new Error(`There is no source with this ID=${id}`);
        const geojsonSource = this.sourceCaches[id].getSource();
        if (geojsonSource.type !== 'geojson')
            throw new Error(`geojsonSource.type is ${geojsonSource.type}, which is !== 'geojson`);
        geojsonSource.setData(data);
        this._changed = true;
    }
    getSource(id) {
        return this.sourceCaches[id] && this.sourceCaches[id].getSource();
    }
    addLayer(layerObject, before, options = {}) {
        this._checkLoaded();
        const id = layerObject.id;
        if (this.getLayer(id)) {
            this.fire(new ErrorEvent(new Error(`Layer "${id}" already exists on this map.`)));
            return;
        }
        let layer;
        if (layerObject.type === 'custom') {
            if (emitValidationErrors(this, validateCustomStyleLayer(layerObject)))
                return;
            layer = createStyleLayer(layerObject, this._globalState);
        }
        else {
            if ('source' in layerObject && typeof layerObject.source === 'object') {
                this.addSource(id, layerObject.source);
                layerObject = clone(layerObject);
                layerObject = extend(layerObject, { source: id });
            }
            if (this._validate(validateStyle.layer, `layers.${id}`, layerObject, { arrayIndex: -1 }, options))
                return;
            layer = createStyleLayer(layerObject, this._globalState);
            this._validateLayer(layer);
            layer.setEventedParent(this, { layer: { id } });
        }
        const index = before ? this._order.indexOf(before) : this._order.length;
        if (before && index === -1) {
            this.fire(new ErrorEvent(new Error(`Cannot add layer "${id}" before non-existing layer "${before}".`)));
            return;
        }
        this._order.splice(index, 0, id);
        this._layerOrderChanged = true;
        this._layers[id] = layer;
        if (this._removedLayers[id] && layer.source && layer.type !== 'custom') {
            const removed = this._removedLayers[id];
            delete this._removedLayers[id];
            if (removed.type !== layer.type) {
                this._updatedSources[layer.source] = 'clear';
            }
            else {
                this._updatedSources[layer.source] = 'reload';
                this.sourceCaches[layer.source].pause();
            }
        }
        this._updateLayer(layer);
        if (layer.onAdd) {
            layer.onAdd(this.map);
        }
    }
    moveLayer(id, before) {
        this._checkLoaded();
        this._changed = true;
        const layer = this._layers[id];
        if (!layer) {
            this.fire(new ErrorEvent(new Error(`The layer '${id}' does not exist in the map's style and cannot be moved.`)));
            return;
        }
        if (id === before) {
            return;
        }
        const index = this._order.indexOf(id);
        this._order.splice(index, 1);
        const newIndex = before ? this._order.indexOf(before) : this._order.length;
        if (before && newIndex === -1) {
            this.fire(new ErrorEvent(new Error(`Cannot move layer "${id}" before non-existing layer "${before}".`)));
            return;
        }
        this._order.splice(newIndex, 0, id);
        this._layerOrderChanged = true;
    }
    removeLayer(id) {
        this._checkLoaded();
        const layer = this._layers[id];
        if (!layer) {
            this.fire(new ErrorEvent(new Error(`Cannot remove non-existing layer "${id}".`)));
            return;
        }
        layer.setEventedParent(null);
        const index = this._order.indexOf(id);
        this._order.splice(index, 1);
        this._layerOrderChanged = true;
        this._changed = true;
        this._removedLayers[id] = layer;
        delete this._layers[id];
        if (this._serializedLayers) {
            delete this._serializedLayers[id];
        }
        delete this._updatedLayers[id];
        delete this._updatedPaintProps[id];
        if (layer.onRemove) {
            layer.onRemove(this.map);
        }
    }
    getLayer(id) {
        return this._layers[id];
    }
    getLayersOrder() {
        return [...this._order];
    }
    hasLayer(id) {
        return id in this._layers;
    }
    setLayerZoomRange(layerId, minzoom, maxzoom) {
        this._checkLoaded();
        const layer = this.getLayer(layerId);
        if (!layer) {
            this.fire(new ErrorEvent(new Error(`Cannot set the zoom range of non-existing layer "${layerId}".`)));
            return;
        }
        if (layer.minzoom === minzoom && layer.maxzoom === maxzoom)
            return;
        if (minzoom != null) {
            layer.minzoom = minzoom;
        }
        if (maxzoom != null) {
            layer.maxzoom = maxzoom;
        }
        this._updateLayer(layer);
    }
    setFilter(layerId, filter, options = {}) {
        this._checkLoaded();
        const layer = this.getLayer(layerId);
        if (!layer) {
            this.fire(new ErrorEvent(new Error(`Cannot filter non-existing layer "${layerId}".`)));
            return;
        }
        if (deepEqual(layer.filter, filter)) {
            return;
        }
        if (filter === null || filter === undefined) {
            layer.setFilter(undefined);
            this._updateLayer(layer);
            return;
        }
        if (this._validate(validateStyle.filter, `layers.${layer.id}.filter`, filter, null, options)) {
            return;
        }
        layer.setFilter(clone(filter));
        this._updateLayer(layer);
    }
    getFilter(layer) {
        return clone(this.getLayer(layer).filter);
    }
    setLayoutProperty(layerId, name, value, options = {}) {
        this._checkLoaded();
        const layer = this.getLayer(layerId);
        if (!layer) {
            this.fire(new ErrorEvent(new Error(`Cannot style non-existing layer "${layerId}".`)));
            return;
        }
        if (deepEqual(layer.getLayoutProperty(name), value))
            return;
        layer.setLayoutProperty(name, value, options);
        this._updateLayer(layer);
    }
    getLayoutProperty(layerId, name) {
        const layer = this.getLayer(layerId);
        if (!layer) {
            this.fire(new ErrorEvent(new Error(`Cannot get style of non-existing layer "${layerId}".`)));
            return;
        }
        return layer.getLayoutProperty(name);
    }
    setPaintProperty(layerId, name, value, options = {}) {
        this._checkLoaded();
        const layer = this.getLayer(layerId);
        if (!layer) {
            this.fire(new ErrorEvent(new Error(`Cannot style non-existing layer "${layerId}".`)));
            return;
        }
        if (deepEqual(layer.getPaintProperty(name), value))
            return;
        this._updatePaintProperty(layer, name, value, options);
    }
    _updatePaintProperty(layer, name, value, options = {}) {
        const requiresRelayout = layer.setPaintProperty(name, value, options);
        if (requiresRelayout) {
            this._updateLayer(layer);
        }
        this._changed = true;
        this._updatedPaintProps[layer.id] = true;
        this._serializedLayers = null;
    }
    getPaintProperty(layer, name) {
        return this.getLayer(layer).getPaintProperty(name);
    }
    setFeatureState(target, state) {
        this._checkLoaded();
        const sourceId = target.source;
        const sourceLayer = target.sourceLayer;
        const sourceCache = this.sourceCaches[sourceId];
        if (sourceCache === undefined) {
            this.fire(new ErrorEvent(new Error(`The source '${sourceId}' does not exist in the map's style.`)));
            return;
        }
        const sourceType = sourceCache.getSource().type;
        if (sourceType === 'geojson' && sourceLayer) {
            this.fire(new ErrorEvent(new Error('GeoJSON sources cannot have a sourceLayer parameter.')));
            return;
        }
        if (sourceType === 'vector' && !sourceLayer) {
            this.fire(new ErrorEvent(new Error('The sourceLayer parameter must be provided for vector source types.')));
            return;
        }
        if (target.id === undefined) {
            this.fire(new ErrorEvent(new Error('The feature id parameter must be provided.')));
        }
        sourceCache.setFeatureState(sourceLayer, target.id, state);
    }
    removeFeatureState(target, key) {
        this._checkLoaded();
        const sourceId = target.source;
        const sourceCache = this.sourceCaches[sourceId];
        if (sourceCache === undefined) {
            this.fire(new ErrorEvent(new Error(`The source '${sourceId}' does not exist in the map's style.`)));
            return;
        }
        const sourceType = sourceCache.getSource().type;
        const sourceLayer = sourceType === 'vector' ? target.sourceLayer : undefined;
        if (sourceType === 'vector' && !sourceLayer) {
            this.fire(new ErrorEvent(new Error('The sourceLayer parameter must be provided for vector source types.')));
            return;
        }
        if (key && (typeof target.id !== 'string' && typeof target.id !== 'number')) {
            this.fire(new ErrorEvent(new Error('A feature id is required to remove its specific state property.')));
            return;
        }
        sourceCache.removeFeatureState(sourceLayer, target.id, key);
    }
    getFeatureState(target) {
        this._checkLoaded();
        const sourceId = target.source;
        const sourceLayer = target.sourceLayer;
        const sourceCache = this.sourceCaches[sourceId];
        if (sourceCache === undefined) {
            this.fire(new ErrorEvent(new Error(`The source '${sourceId}' does not exist in the map's style.`)));
            return;
        }
        const sourceType = sourceCache.getSource().type;
        if (sourceType === 'vector' && !sourceLayer) {
            this.fire(new ErrorEvent(new Error('The sourceLayer parameter must be provided for vector source types.')));
            return;
        }
        if (target.id === undefined) {
            this.fire(new ErrorEvent(new Error('The feature id parameter must be provided.')));
        }
        return sourceCache.getFeatureState(sourceLayer, target.id);
    }
    getTransition() {
        return extend({ duration: 300, delay: 0 }, this.stylesheet && this.stylesheet.transition);
    }
    serialize() {
        if (!this._loaded)
            return;
        const sources = mapObject(this.sourceCaches, (source) => source.serialize());
        const layers = this._serializeByIds(this._order, true);
        const terrain = this.map.getTerrain() || undefined;
        const myStyleSheet = this.stylesheet;
        return filterObject({
            version: myStyleSheet.version,
            name: myStyleSheet.name,
            metadata: myStyleSheet.metadata,
            light: myStyleSheet.light,
            sky: myStyleSheet.sky,
            center: myStyleSheet.center,
            zoom: myStyleSheet.zoom,
            bearing: myStyleSheet.bearing,
            pitch: myStyleSheet.pitch,
            sprite: myStyleSheet.sprite,
            glyphs: myStyleSheet.glyphs,
            transition: myStyleSheet.transition,
            projection: myStyleSheet.projection,
            sources,
            layers,
            terrain
        }, (value) => { return value !== undefined; });
    }
    _updateLayer(layer) {
        this._updatedLayers[layer.id] = true;
        if (layer.source && !this._updatedSources[layer.source] &&
            this.sourceCaches[layer.source].getSource().type !== 'raster') {
            this._updatedSources[layer.source] = 'reload';
            this.sourceCaches[layer.source].pause();
        }
        this._serializedLayers = null;
        this._changed = true;
    }
    _flattenAndSortRenderedFeatures(sourceResults) {
        const isLayer3D = layerId => this._layers[layerId].type === 'fill-extrusion';
        const layerIndex = {};
        const features3D = [];
        for (let l = this._order.length - 1; l >= 0; l--) {
            const layerId = this._order[l];
            if (isLayer3D(layerId)) {
                layerIndex[layerId] = l;
                for (const sourceResult of sourceResults) {
                    const layerFeatures = sourceResult[layerId];
                    if (layerFeatures) {
                        for (const featureWrapper of layerFeatures) {
                            features3D.push(featureWrapper);
                        }
                    }
                }
            }
        }
        features3D.sort((a, b) => {
            return b.intersectionZ - a.intersectionZ;
        });
        const features = [];
        for (let l = this._order.length - 1; l >= 0; l--) {
            const layerId = this._order[l];
            if (isLayer3D(layerId)) {
                for (let i = features3D.length - 1; i >= 0; i--) {
                    const topmost3D = features3D[i].feature;
                    if (layerIndex[topmost3D.layer.id] < l)
                        break;
                    features.push(topmost3D);
                    features3D.pop();
                }
            }
            else {
                for (const sourceResult of sourceResults) {
                    const layerFeatures = sourceResult[layerId];
                    if (layerFeatures) {
                        for (const featureWrapper of layerFeatures) {
                            features.push(featureWrapper.feature);
                        }
                    }
                }
            }
        }
        return features;
    }
    queryRenderedFeatures(queryGeometry, params, transform) {
        if (params && params.filter) {
            this._validate(validateStyle.filter, 'queryRenderedFeatures.filter', params.filter, null, params);
        }
        const includedSources = {};
        if (params && params.layers) {
            const isArrayOrSet = Array.isArray(params.layers) || params.layers instanceof Set;
            if (!isArrayOrSet) {
                this.fire(new ErrorEvent(new Error('parameters.layers must be an Array or a Set of strings')));
                return [];
            }
            for (const layerId of params.layers) {
                const layer = this._layers[layerId];
                if (!layer) {
                    this.fire(new ErrorEvent(new Error(`The layer '${layerId}' does not exist in the map's style and cannot be queried for features.`)));
                    return [];
                }
                includedSources[layer.source] = true;
            }
        }
        const sourceResults = [];
        params.availableImages = this._availableImages;
        const serializedLayers = this._serializedAllLayers();
        const layersAsSet = params.layers instanceof Set ? params.layers : Array.isArray(params.layers) ? new Set(params.layers) : null;
        const paramsStrict = Object.assign(Object.assign({}, params), { layers: layersAsSet, globalState: this._globalState });
        for (const id in this.sourceCaches) {
            if (params.layers && !includedSources[id])
                continue;
            sourceResults.push(queryRenderedFeatures(this.sourceCaches[id], this._layers, serializedLayers, queryGeometry, paramsStrict, transform, this.map.terrain ?
                (id, x, y) => this.map.terrain.getElevation(id, x, y) :
                undefined));
        }
        if (this.placement) {
            sourceResults.push(queryRenderedSymbols(this._layers, serializedLayers, this.sourceCaches, queryGeometry, paramsStrict, this.placement.collisionIndex, this.placement.retainedQueryData));
        }
        return this._flattenAndSortRenderedFeatures(sourceResults);
    }
    querySourceFeatures(sourceID, params) {
        if (params === null || params === void 0 ? void 0 : params.filter) {
            this._validate(validateStyle.filter, 'querySourceFeatures.filter', params.filter, null, params);
        }
        const sourceCache = this.sourceCaches[sourceID];
        return sourceCache ? querySourceFeatures(sourceCache, params ? Object.assign(Object.assign({}, params), { globalState: this._globalState }) : { globalState: this._globalState }) : [];
    }
    getLight() {
        return this.light.getLight();
    }
    setLight(lightOptions, options = {}) {
        this._checkLoaded();
        const light = this.light.getLight();
        let _update = false;
        for (const key in lightOptions) {
            if (!deepEqual(lightOptions[key], light[key])) {
                _update = true;
                break;
            }
        }
        if (!_update)
            return;
        const parameters = {
            now: browser.now(),
            transition: extend({
                duration: 300,
                delay: 0
            }, this.stylesheet.transition)
        };
        this.light.setLight(lightOptions, options);
        this.light.updateTransitions(parameters);
    }
    getProjection() {
        var _a;
        return (_a = this.stylesheet) === null || _a === void 0 ? void 0 : _a.projection;
    }
    setProjection(projection) {
        this._checkLoaded();
        if (this.projection) {
            if (this.projection.name === projection.type)
                return;
            this.projection.destroy();
            delete this.projection;
        }
        this.stylesheet.projection = projection;
        this._setProjectionInternal(projection.type);
    }
    getSky() {
        var _a;
        return (_a = this.stylesheet) === null || _a === void 0 ? void 0 : _a.sky;
    }
    setSky(skyOptions, options = {}) {
        this._checkLoaded();
        const sky = this.getSky();
        let update = false;
        if (!skyOptions && !sky)
            return;
        if (skyOptions && !sky) {
            update = true;
        }
        else if (!skyOptions && sky) {
            update = true;
        }
        else {
            for (const key in skyOptions) {
                if (!deepEqual(skyOptions[key], sky[key])) {
                    update = true;
                    break;
                }
            }
        }
        if (!update)
            return;
        const parameters = {
            now: browser.now(),
            transition: extend({
                duration: 300,
                delay: 0
            }, this.stylesheet.transition)
        };
        this.stylesheet.sky = skyOptions;
        this.sky.setSky(skyOptions, options);
        this.sky.updateTransitions(parameters);
    }
    _setProjectionInternal(name) {
        const projectionObjects = createProjectionFromName(name);
        this.projection = projectionObjects.projection;
        this.map.migrateProjection(projectionObjects.transform, projectionObjects.cameraHelper);
        for (const key in this.sourceCaches) {
            this.sourceCaches[key].reload();
        }
    }
    _validate(validate, key, value, props, options = {}) {
        if (options && options.validate === false) {
            return false;
        }
        return emitValidationErrors(this, validate.call(validateStyle, extend({
            key,
            style: this.serialize(),
            value,
            styleSpec
        }, props)));
    }
    _remove(mapRemoved = true) {
        if (this._frameRequest) {
            this._frameRequest.abort();
            this._frameRequest = null;
        }
        if (this._loadStyleRequest) {
            this._loadStyleRequest.abort();
            this._loadStyleRequest = null;
        }
        if (this._spriteRequest) {
            this._spriteRequest.abort();
            this._spriteRequest = null;
        }
        rtlMainThreadPluginFactory().off(RTLPluginLoadedEventName, this._rtlPluginLoaded);
        for (const layerId in this._layers) {
            const layer = this._layers[layerId];
            layer.setEventedParent(null);
        }
        for (const id in this.sourceCaches) {
            const sourceCache = this.sourceCaches[id];
            sourceCache.setEventedParent(null);
            sourceCache.onRemove(this.map);
        }
        this.imageManager.setEventedParent(null);
        this.setEventedParent(null);
        if (mapRemoved) {
            this.dispatcher.broadcast("RM", undefined);
        }
        this.dispatcher.remove(mapRemoved);
    }
    _clearSource(id) {
        this.sourceCaches[id].clearTiles();
    }
    _reloadSource(id) {
        this.sourceCaches[id].resume();
        this.sourceCaches[id].reload();
    }
    _updateSources(transform) {
        for (const id in this.sourceCaches) {
            this.sourceCaches[id].update(transform, this.map.terrain);
        }
    }
    _generateCollisionBoxes() {
        for (const id in this.sourceCaches) {
            this._reloadSource(id);
        }
    }
    _updatePlacement(transform, showCollisionBoxes, fadeDuration, crossSourceCollisions, forceFullPlacement = false) {
        let symbolBucketsChanged = false;
        let placementCommitted = false;
        const layerTiles = {};
        for (const layerID of this._order) {
            const styleLayer = this._layers[layerID];
            if (styleLayer.type !== 'symbol')
                continue;
            if (!layerTiles[styleLayer.source]) {
                const sourceCache = this.sourceCaches[styleLayer.source];
                layerTiles[styleLayer.source] = sourceCache.getRenderableIds(true)
                    .map((id) => sourceCache.getTileByID(id))
                    .sort((a, b) => (b.tileID.overscaledZ - a.tileID.overscaledZ) || (a.tileID.isLessThan(b.tileID) ? -1 : 1));
            }
            const layerBucketsChanged = this.crossTileSymbolIndex.addLayer(styleLayer, layerTiles[styleLayer.source], transform.center.lng);
            symbolBucketsChanged = symbolBucketsChanged || layerBucketsChanged;
        }
        this.crossTileSymbolIndex.pruneUnusedLayers(this._order);
        forceFullPlacement = forceFullPlacement || this._layerOrderChanged || fadeDuration === 0;
        if (forceFullPlacement || !this.pauseablePlacement || (this.pauseablePlacement.isDone() && !this.placement.stillRecent(browser.now(), transform.zoom))) {
            this.pauseablePlacement = new PauseablePlacement(transform, this.map.terrain, this._order, forceFullPlacement, showCollisionBoxes, fadeDuration, crossSourceCollisions, this.placement);
            this._layerOrderChanged = false;
        }
        if (this.pauseablePlacement.isDone()) {
            this.placement.setStale();
        }
        else {
            this.pauseablePlacement.continuePlacement(this._order, this._layers, layerTiles);
            if (this.pauseablePlacement.isDone()) {
                this.placement = this.pauseablePlacement.commit(browser.now());
                placementCommitted = true;
            }
            if (symbolBucketsChanged) {
                this.pauseablePlacement.placement.setStale();
            }
        }
        if (placementCommitted || symbolBucketsChanged) {
            for (const layerID of this._order) {
                const styleLayer = this._layers[layerID];
                if (styleLayer.type !== 'symbol')
                    continue;
                this.placement.updateLayerOpacities(styleLayer, layerTiles[styleLayer.source]);
            }
        }
        const needsRerender = !this.pauseablePlacement.isDone() || this.placement.hasTransitions(browser.now());
        return needsRerender;
    }
    _releaseSymbolFadeTiles() {
        for (const id in this.sourceCaches) {
            this.sourceCaches[id].releaseSymbolFadeTiles();
        }
    }
    getImages(mapId, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const images = yield this.imageManager.getImages(params.icons);
            this._updateTilesForChangedImages();
            const sourceCache = this.sourceCaches[params.source];
            if (sourceCache) {
                sourceCache.setDependencies(params.tileID.key, params.type, params.icons);
            }
            return images;
        });
    }
    getGlyphs(mapId, params) {
        return __awaiter(this, void 0, void 0, function* () {
            const glyphs = yield this.glyphManager.getGlyphs(params.stacks);
            const sourceCache = this.sourceCaches[params.source];
            if (sourceCache) {
                sourceCache.setDependencies(params.tileID.key, params.type, ['']);
            }
            return glyphs;
        });
    }
    getGlyphsUrl() {
        return this.stylesheet.glyphs || null;
    }
    setGlyphs(glyphsUrl, options = {}) {
        this._checkLoaded();
        if (glyphsUrl && this._validate(validateStyle.glyphs, 'glyphs', glyphsUrl, null, options)) {
            return;
        }
        this._glyphsDidChange = true;
        this.stylesheet.glyphs = glyphsUrl;
        this.glyphManager.entries = {};
        this.glyphManager.setURL(glyphsUrl);
    }
    addSprite(id, url, options = {}, completion) {
        this._checkLoaded();
        const spriteToAdd = [{ id, url }];
        const updatedSprite = [
            ...coerceSpriteToArray(this.stylesheet.sprite),
            ...spriteToAdd
        ];
        if (this._validate(validateStyle.sprite, 'sprite', updatedSprite, null, options))
            return;
        this.stylesheet.sprite = updatedSprite;
        this._loadSprite(spriteToAdd, true, completion);
    }
    removeSprite(id) {
        this._checkLoaded();
        const internalSpriteRepresentation = coerceSpriteToArray(this.stylesheet.sprite);
        if (!internalSpriteRepresentation.find(sprite => sprite.id === id)) {
            this.fire(new ErrorEvent(new Error(`Sprite "${id}" doesn't exists on this map.`)));
            return;
        }
        if (this._spritesImagesIds[id]) {
            for (const imageId of this._spritesImagesIds[id]) {
                this.imageManager.removeImage(imageId);
                this._changedImages[imageId] = true;
            }
        }
        internalSpriteRepresentation.splice(internalSpriteRepresentation.findIndex(sprite => sprite.id === id), 1);
        this.stylesheet.sprite = internalSpriteRepresentation.length > 0 ? internalSpriteRepresentation : undefined;
        delete this._spritesImagesIds[id];
        this._availableImages = this.imageManager.listImages();
        this._changed = true;
        this.dispatcher.broadcast("SI", this._availableImages);
        this.fire(new Event('data', { dataType: 'style' }));
    }
    getSprite() {
        return coerceSpriteToArray(this.stylesheet.sprite);
    }
    setSprite(sprite, options = {}, completion) {
        this._checkLoaded();
        if (sprite && this._validate(validateStyle.sprite, 'sprite', sprite, null, options)) {
            return;
        }
        this.stylesheet.sprite = sprite;
        if (sprite) {
            this._loadSprite(sprite, true, completion);
        }
        else {
            this._unloadSprite();
            if (completion) {
                completion(null);
            }
        }
    }
}
//# sourceMappingURL=style.js.map