import { extend, warnOnce, uniqueId, isImageBitmap, pick } from '../util/util';
import { browser } from '../util/browser';
import { DOM } from '../util/dom';
import packageJSON from '../../package.json' with { type: 'json' };
import { getJSON } from '../util/ajax';
import { ImageRequest } from '../util/image_request';
import { RequestManager } from '../util/request_manager';
import { Style } from '../style/style';
import { EvaluationParameters } from '../style/evaluation_parameters';
import { Painter } from '../render/painter';
import { Hash } from './hash';
import { HandlerManager } from './handler_manager';
import { Camera } from './camera';
import { LngLat } from '../geo/lng_lat';
import { LngLatBounds } from '../geo/lng_lat_bounds';
import Point from '@mapbox/point-geometry';
import { AttributionControl, defaultAttributionControlOptions } from './control/attribution_control';
import { LogoControl } from './control/logo_control';
import { RGBAImage } from '../util/image';
import { Event, ErrorEvent } from '../util/evented';
import { MapMouseEvent } from './events';
import { TaskQueue } from '../util/task_queue';
import { throttle } from '../util/throttle';
import { webpSupported } from '../util/webp_supported';
import { PerformanceMarkers, PerformanceUtils } from '../util/performance';
import { Terrain } from '../render/terrain';
import { RenderToTexture } from '../render/render_to_texture';
import { config } from '../util/config';
import { defaultLocale } from './default_locale';
import { MercatorTransform } from '../geo/projection/mercator_transform';
import { MercatorCameraHelper } from '../geo/projection/mercator_camera_helper';
import { isAbortError } from '../util/abort_error';
import { isFramebufferNotCompleteError } from '../util/framebuffer_error';
import { coveringTiles, createCalculateTileZoomFunction } from '../geo/projection/covering_tiles';
import { CanonicalTileID } from '../source/tile_id';
const version = packageJSON.version;
const defaultMinZoom = -2;
const defaultMaxZoom = 22;
const defaultMinPitch = 0;
const defaultMaxPitch = 60;
const maxPitchThreshold = 180;
const defaultOptions = {
    hash: false,
    interactive: true,
    bearingSnap: 7,
    attributionControl: defaultAttributionControlOptions,
    maplibreLogo: false,
    refreshExpiredTiles: true,
    canvasContextAttributes: {
        antialias: false,
        preserveDrawingBuffer: false,
        powerPreference: 'high-performance',
        failIfMajorPerformanceCaveat: false,
        desynchronized: false,
        contextType: undefined
    },
    scrollZoom: true,
    minZoom: defaultMinZoom,
    maxZoom: defaultMaxZoom,
    minPitch: defaultMinPitch,
    maxPitch: defaultMaxPitch,
    boxZoom: true,
    dragRotate: true,
    dragPan: true,
    keyboard: true,
    doubleClickZoom: true,
    touchZoomRotate: true,
    touchPitch: true,
    cooperativeGestures: false,
    trackResize: true,
    center: [0, 0],
    elevation: 0,
    zoom: 0,
    bearing: 0,
    pitch: 0,
    roll: 0,
    renderWorldCopies: true,
    maxTileCacheSize: null,
    maxTileCacheZoomLevels: config.MAX_TILE_CACHE_ZOOM_LEVELS,
    transformRequest: null,
    transformCameraUpdate: null,
    fadeDuration: 300,
    crossSourceCollisions: true,
    clickTolerance: 3,
    localIdeographFontFamily: 'sans-serif',
    pitchWithRotate: true,
    rollEnabled: false,
    validateStyle: true,
    maxCanvasSize: [4096, 4096],
    cancelPendingTileRequestsWhileZooming: true,
    centerClampedToGround: true
};
export class Map extends Camera {
    constructor(options) {
        var _a, _b;
        PerformanceUtils.mark(PerformanceMarkers.create);
        const resolvedOptions = Object.assign(Object.assign(Object.assign({}, defaultOptions), options), { canvasContextAttributes: Object.assign(Object.assign({}, defaultOptions.canvasContextAttributes), options.canvasContextAttributes) });
        if (resolvedOptions.minZoom != null && resolvedOptions.maxZoom != null && resolvedOptions.minZoom > resolvedOptions.maxZoom) {
            throw new Error('maxZoom must be greater than or equal to minZoom');
        }
        if (resolvedOptions.minPitch != null && resolvedOptions.maxPitch != null && resolvedOptions.minPitch > resolvedOptions.maxPitch) {
            throw new Error('maxPitch must be greater than or equal to minPitch');
        }
        if (resolvedOptions.minPitch != null && resolvedOptions.minPitch < defaultMinPitch) {
            throw new Error(`minPitch must be greater than or equal to ${defaultMinPitch}`);
        }
        if (resolvedOptions.maxPitch != null && resolvedOptions.maxPitch > maxPitchThreshold) {
            throw new Error(`maxPitch must be less than or equal to ${maxPitchThreshold}`);
        }
        const transform = new MercatorTransform();
        const cameraHelper = new MercatorCameraHelper();
        if (resolvedOptions.minZoom !== undefined) {
            transform.setMinZoom(resolvedOptions.minZoom);
        }
        if (resolvedOptions.maxZoom !== undefined) {
            transform.setMaxZoom(resolvedOptions.maxZoom);
        }
        if (resolvedOptions.minPitch !== undefined) {
            transform.setMinPitch(resolvedOptions.minPitch);
        }
        if (resolvedOptions.maxPitch !== undefined) {
            transform.setMaxPitch(resolvedOptions.maxPitch);
        }
        if (resolvedOptions.renderWorldCopies !== undefined) {
            transform.setRenderWorldCopies(resolvedOptions.renderWorldCopies);
        }
        super(transform, cameraHelper, { bearingSnap: resolvedOptions.bearingSnap });
        this._idleTriggered = false;
        this._crossFadingFactor = 1;
        this._renderTaskQueue = new TaskQueue();
        this._controls = [];
        this._mapId = uniqueId();
        this._contextLost = (event) => {
            event.preventDefault();
            if (this._frameRequest) {
                this._frameRequest.abort();
                this._frameRequest = null;
            }
            this.fire(new Event('webglcontextlost', { originalEvent: event }));
        };
        this._contextRestored = (event) => {
            this._setupPainter();
            this.resize();
            this._update();
            this.fire(new Event('webglcontextrestored', { originalEvent: event }));
        };
        this._onMapScroll = (event) => {
            if (event.target !== this._container)
                return;
            this._container.scrollTop = 0;
            this._container.scrollLeft = 0;
            return false;
        };
        this._onWindowOnline = () => {
            this._update();
        };
        this._interactive = resolvedOptions.interactive;
        this._maxTileCacheSize = resolvedOptions.maxTileCacheSize;
        this._maxTileCacheZoomLevels = resolvedOptions.maxTileCacheZoomLevels;
        this._canvasContextAttributes = Object.assign({}, resolvedOptions.canvasContextAttributes);
        this._trackResize = resolvedOptions.trackResize === true;
        this._bearingSnap = resolvedOptions.bearingSnap;
        this._centerClampedToGround = resolvedOptions.centerClampedToGround;
        this._refreshExpiredTiles = resolvedOptions.refreshExpiredTiles === true;
        this._fadeDuration = resolvedOptions.fadeDuration;
        this._crossSourceCollisions = resolvedOptions.crossSourceCollisions === true;
        this._collectResourceTiming = resolvedOptions.collectResourceTiming === true;
        this._locale = Object.assign(Object.assign({}, defaultLocale), resolvedOptions.locale);
        this._clickTolerance = resolvedOptions.clickTolerance;
        this._overridePixelRatio = resolvedOptions.pixelRatio;
        this._maxCanvasSize = resolvedOptions.maxCanvasSize;
        this.transformCameraUpdate = resolvedOptions.transformCameraUpdate;
        this.cancelPendingTileRequestsWhileZooming = resolvedOptions.cancelPendingTileRequestsWhileZooming === true;
        this._imageQueueHandle = ImageRequest.addThrottleControl(() => this.isMoving());
        this._requestManager = new RequestManager(resolvedOptions.transformRequest);
        if (typeof resolvedOptions.container === 'string') {
            this._container = document.getElementById(resolvedOptions.container);
            if (!this._container) {
                throw new Error(`Container '${resolvedOptions.container}' not found.`);
            }
        }
        else if (resolvedOptions.container instanceof HTMLElement) {
            this._container = resolvedOptions.container;
        }
        else {
            throw new Error('Invalid type: \'container\' must be a String or HTMLElement.');
        }
        if (resolvedOptions.maxBounds) {
            this.setMaxBounds(resolvedOptions.maxBounds);
        }
        this._setupContainer();
        this._setupPainter();
        this.on('move', () => this._update(false));
        this.on('moveend', () => this._update(false));
        this.on('zoom', () => this._update(true));
        this.on('terrain', () => {
            this.painter.terrainFacilitator.dirty = true;
            this._update(true);
        });
        this.once('idle', () => { this._idleTriggered = true; });
        if (typeof window !== 'undefined') {
            addEventListener('online', this._onWindowOnline, false);
            let initialResizeEventCaptured = false;
            const throttledResizeCallback = throttle((entries) => {
                if (this._trackResize && !this._removed) {
                    this.resize(entries);
                    this.redraw();
                }
            }, 50);
            this._resizeObserver = new ResizeObserver((entries) => {
                if (!initialResizeEventCaptured) {
                    initialResizeEventCaptured = true;
                    return;
                }
                throttledResizeCallback(entries);
            });
            this._resizeObserver.observe(this._container);
        }
        this.handlers = new HandlerManager(this, resolvedOptions);
        const hashName = (typeof resolvedOptions.hash === 'string' && resolvedOptions.hash) || undefined;
        this._hash = resolvedOptions.hash && (new Hash(hashName)).addTo(this);
        if (!this._hash || !this._hash._onHashChange()) {
            this.jumpTo({
                center: resolvedOptions.center,
                elevation: resolvedOptions.elevation,
                zoom: resolvedOptions.zoom,
                bearing: resolvedOptions.bearing,
                pitch: resolvedOptions.pitch,
                roll: resolvedOptions.roll
            });
            if (resolvedOptions.bounds) {
                this.resize();
                this.fitBounds(resolvedOptions.bounds, extend({}, resolvedOptions.fitBoundsOptions, { duration: 0 }));
            }
        }
        const shouldConstrainUsingMercatorTransform = typeof resolvedOptions.style === 'string' || !(((_b = (_a = resolvedOptions.style) === null || _a === void 0 ? void 0 : _a.projection) === null || _b === void 0 ? void 0 : _b.type) === 'globe');
        this.resize(null, shouldConstrainUsingMercatorTransform);
        this._localIdeographFontFamily = resolvedOptions.localIdeographFontFamily;
        this._validateStyle = resolvedOptions.validateStyle;
        if (resolvedOptions.style)
            this.setStyle(resolvedOptions.style, { localIdeographFontFamily: resolvedOptions.localIdeographFontFamily });
        if (resolvedOptions.attributionControl)
            this.addControl(new AttributionControl(typeof resolvedOptions.attributionControl === 'boolean' ? undefined : resolvedOptions.attributionControl));
        if (resolvedOptions.maplibreLogo)
            this.addControl(new LogoControl(), resolvedOptions.logoPosition);
        this.on('style.load', () => {
            if (!shouldConstrainUsingMercatorTransform)
                this._resizeTransform();
            if (this.transform.unmodified) {
                const coercedOptions = pick(this.style.stylesheet, ['center', 'zoom', 'bearing', 'pitch', 'roll']);
                this.jumpTo(coercedOptions);
            }
        });
        this.on('data', (event) => {
            this._update(event.dataType === 'style');
            this.fire(new Event(`${event.dataType}data`, event));
        });
        this.on('dataloading', (event) => {
            this.fire(new Event(`${event.dataType}dataloading`, event));
        });
        this.on('dataabort', (event) => {
            this.fire(new Event('sourcedataabort', event));
        });
    }
    _getMapId() {
        return this._mapId;
    }
    setGlobalStateProperty(propertyName, value) {
        this.style.setGlobalStateProperty(propertyName, value);
        return this._update(true);
    }
    getGlobalState() {
        return this.style.getGlobalState();
    }
    addControl(control, position) {
        if (position === undefined) {
            if (control.getDefaultPosition) {
                position = control.getDefaultPosition();
            }
            else {
                position = 'top-right';
            }
        }
        if (!control || !control.onAdd) {
            return this.fire(new ErrorEvent(new Error('Invalid argument to map.addControl(). Argument must be a control with onAdd and onRemove methods.')));
        }
        const controlElement = control.onAdd(this);
        this._controls.push(control);
        const positionContainer = this._controlPositions[position];
        if (position.indexOf('bottom') !== -1) {
            positionContainer.insertBefore(controlElement, positionContainer.firstChild);
        }
        else {
            positionContainer.appendChild(controlElement);
        }
        return this;
    }
    removeControl(control) {
        if (!control || !control.onRemove) {
            return this.fire(new ErrorEvent(new Error('Invalid argument to map.removeControl(). Argument must be a control with onAdd and onRemove methods.')));
        }
        const ci = this._controls.indexOf(control);
        if (ci > -1)
            this._controls.splice(ci, 1);
        control.onRemove(this);
        return this;
    }
    hasControl(control) {
        return this._controls.indexOf(control) > -1;
    }
    coveringTiles(options) {
        return coveringTiles(this.transform, options);
    }
    calculateCameraOptionsFromTo(from, altitudeFrom, to, altitudeTo) {
        if (altitudeTo == null && this.terrain) {
            altitudeTo = this.terrain.getElevationForLngLatZoom(to, this.transform.tileZoom);
        }
        return super.calculateCameraOptionsFromTo(from, altitudeFrom, to, altitudeTo);
    }
    resize(eventData, constrainTransform = true) {
        const [width, height] = this._containerDimensions();
        const clampedPixelRatio = this._getClampedPixelRatio(width, height);
        this._resizeCanvas(width, height, clampedPixelRatio);
        this.painter.resize(width, height, clampedPixelRatio);
        if (this.painter.overLimit()) {
            const gl = this.painter.context.gl;
            this._maxCanvasSize = [gl.drawingBufferWidth, gl.drawingBufferHeight];
            const clampedPixelRatio = this._getClampedPixelRatio(width, height);
            this._resizeCanvas(width, height, clampedPixelRatio);
            this.painter.resize(width, height, clampedPixelRatio);
        }
        this._resizeTransform(constrainTransform);
        const fireMoving = !this._moving;
        if (fireMoving) {
            this.stop();
            this.fire(new Event('movestart', eventData))
                .fire(new Event('move', eventData));
        }
        this.fire(new Event('resize', eventData));
        if (fireMoving)
            this.fire(new Event('moveend', eventData));
        return this;
    }
    _resizeTransform(constrainTransform = true) {
        var _a;
        const [width, height] = this._containerDimensions();
        this.transform.resize(width, height, constrainTransform);
        (_a = this._requestedCameraState) === null || _a === void 0 ? void 0 : _a.resize(width, height, constrainTransform);
    }
    _getClampedPixelRatio(width, height) {
        const { 0: maxCanvasWidth, 1: maxCanvasHeight } = this._maxCanvasSize;
        const pixelRatio = this.getPixelRatio();
        const canvasWidth = width * pixelRatio;
        const canvasHeight = height * pixelRatio;
        const widthScaleFactor = canvasWidth > maxCanvasWidth ? (maxCanvasWidth / canvasWidth) : 1;
        const heightScaleFactor = canvasHeight > maxCanvasHeight ? (maxCanvasHeight / canvasHeight) : 1;
        return Math.min(widthScaleFactor, heightScaleFactor) * pixelRatio;
    }
    getPixelRatio() {
        var _a;
        return (_a = this._overridePixelRatio) !== null && _a !== void 0 ? _a : devicePixelRatio;
    }
    setPixelRatio(pixelRatio) {
        this._overridePixelRatio = pixelRatio;
        this.resize();
    }
    getBounds() {
        return this.transform.getBounds();
    }
    getMaxBounds() {
        return this.transform.getMaxBounds();
    }
    setMaxBounds(bounds) {
        this.transform.setMaxBounds(LngLatBounds.convert(bounds));
        return this._update();
    }
    setMinZoom(minZoom) {
        minZoom = minZoom === null || minZoom === undefined ? defaultMinZoom : minZoom;
        if (minZoom >= defaultMinZoom && minZoom <= this.transform.maxZoom) {
            this.transform.setMinZoom(minZoom);
            this._update();
            if (this.getZoom() < minZoom)
                this.setZoom(minZoom);
            return this;
        }
        else
            throw new Error(`minZoom must be between ${defaultMinZoom} and the current maxZoom, inclusive`);
    }
    getMinZoom() { return this.transform.minZoom; }
    setMaxZoom(maxZoom) {
        maxZoom = maxZoom === null || maxZoom === undefined ? defaultMaxZoom : maxZoom;
        if (maxZoom >= this.transform.minZoom) {
            this.transform.setMaxZoom(maxZoom);
            this._update();
            if (this.getZoom() > maxZoom)
                this.setZoom(maxZoom);
            return this;
        }
        else
            throw new Error('maxZoom must be greater than the current minZoom');
    }
    getMaxZoom() { return this.transform.maxZoom; }
    setMinPitch(minPitch) {
        minPitch = minPitch === null || minPitch === undefined ? defaultMinPitch : minPitch;
        if (minPitch < defaultMinPitch) {
            throw new Error(`minPitch must be greater than or equal to ${defaultMinPitch}`);
        }
        if (minPitch >= defaultMinPitch && minPitch <= this.transform.maxPitch) {
            this.transform.setMinPitch(minPitch);
            this._update();
            if (this.getPitch() < minPitch)
                this.setPitch(minPitch);
            return this;
        }
        else
            throw new Error(`minPitch must be between ${defaultMinPitch} and the current maxPitch, inclusive`);
    }
    getMinPitch() { return this.transform.minPitch; }
    setMaxPitch(maxPitch) {
        maxPitch = maxPitch === null || maxPitch === undefined ? defaultMaxPitch : maxPitch;
        if (maxPitch > maxPitchThreshold) {
            throw new Error(`maxPitch must be less than or equal to ${maxPitchThreshold}`);
        }
        if (maxPitch >= this.transform.minPitch) {
            this.transform.setMaxPitch(maxPitch);
            this._update();
            if (this.getPitch() > maxPitch)
                this.setPitch(maxPitch);
            return this;
        }
        else
            throw new Error('maxPitch must be greater than the current minPitch');
    }
    getMaxPitch() { return this.transform.maxPitch; }
    getRenderWorldCopies() { return this.transform.renderWorldCopies; }
    setRenderWorldCopies(renderWorldCopies) {
        this.transform.setRenderWorldCopies(renderWorldCopies);
        return this._update();
    }
    project(lnglat) {
        return this.transform.locationToScreenPoint(LngLat.convert(lnglat), this.style && this.terrain);
    }
    unproject(point) {
        return this.transform.screenPointToLocation(Point.convert(point), this.terrain);
    }
    isMoving() {
        var _a;
        return this._moving || ((_a = this.handlers) === null || _a === void 0 ? void 0 : _a.isMoving());
    }
    isZooming() {
        var _a;
        return this._zooming || ((_a = this.handlers) === null || _a === void 0 ? void 0 : _a.isZooming());
    }
    isRotating() {
        var _a;
        return this._rotating || ((_a = this.handlers) === null || _a === void 0 ? void 0 : _a.isRotating());
    }
    _createDelegatedListener(type, layerIds, listener) {
        if (type === 'mouseenter' || type === 'mouseover') {
            let mousein = false;
            const mousemove = (e) => {
                const existingLayers = layerIds.filter((layerId) => this.getLayer(layerId));
                const features = existingLayers.length !== 0 ? this.queryRenderedFeatures(e.point, { layers: existingLayers }) : [];
                if (!features.length) {
                    mousein = false;
                }
                else if (!mousein) {
                    mousein = true;
                    listener.call(this, new MapMouseEvent(type, this, e.originalEvent, { features }));
                }
            };
            const mouseout = () => {
                mousein = false;
            };
            return { layers: layerIds, listener, delegates: { mousemove, mouseout } };
        }
        else if (type === 'mouseleave' || type === 'mouseout') {
            let mousein = false;
            const mousemove = (e) => {
                const existingLayers = layerIds.filter((layerId) => this.getLayer(layerId));
                const features = existingLayers.length !== 0 ? this.queryRenderedFeatures(e.point, { layers: existingLayers }) : [];
                if (features.length) {
                    mousein = true;
                }
                else if (mousein) {
                    mousein = false;
                    listener.call(this, new MapMouseEvent(type, this, e.originalEvent));
                }
            };
            const mouseout = (e) => {
                if (mousein) {
                    mousein = false;
                    listener.call(this, new MapMouseEvent(type, this, e.originalEvent));
                }
            };
            return { layers: layerIds, listener, delegates: { mousemove, mouseout } };
        }
        else {
            const delegate = (e) => {
                const existingLayers = layerIds.filter((layerId) => this.getLayer(layerId));
                const features = existingLayers.length !== 0 ? this.queryRenderedFeatures(e.point, { layers: existingLayers }) : [];
                if (features.length) {
                    e.features = features;
                    listener.call(this, e);
                    delete e.features;
                }
            };
            return { layers: layerIds, listener, delegates: { [type]: delegate } };
        }
    }
    _saveDelegatedListener(type, delegatedListener) {
        this._delegatedListeners = this._delegatedListeners || {};
        this._delegatedListeners[type] = this._delegatedListeners[type] || [];
        this._delegatedListeners[type].push(delegatedListener);
    }
    _removeDelegatedListener(type, layerIds, listener) {
        if (!this._delegatedListeners || !this._delegatedListeners[type]) {
            return;
        }
        const listeners = this._delegatedListeners[type];
        for (let i = 0; i < listeners.length; i++) {
            const delegatedListener = listeners[i];
            if (delegatedListener.listener === listener &&
                delegatedListener.layers.length === layerIds.length &&
                delegatedListener.layers.every((layerId) => layerIds.includes(layerId))) {
                for (const event in delegatedListener.delegates) {
                    this.off(event, delegatedListener.delegates[event]);
                }
                listeners.splice(i, 1);
                return;
            }
        }
    }
    on(type, layerIdsOrListener, listener) {
        if (listener === undefined) {
            return super.on(type, layerIdsOrListener);
        }
        const layerIds = typeof layerIdsOrListener === 'string' ? [layerIdsOrListener] : layerIdsOrListener;
        const delegatedListener = this._createDelegatedListener(type, layerIds, listener);
        this._saveDelegatedListener(type, delegatedListener);
        for (const event in delegatedListener.delegates) {
            this.on(event, delegatedListener.delegates[event]);
        }
        return {
            unsubscribe: () => {
                this._removeDelegatedListener(type, layerIds, listener);
            }
        };
    }
    once(type, layerIdsOrListener, listener) {
        if (listener === undefined) {
            return super.once(type, layerIdsOrListener);
        }
        const layerIds = typeof layerIdsOrListener === 'string' ? [layerIdsOrListener] : layerIdsOrListener;
        const delegatedListener = this._createDelegatedListener(type, layerIds, listener);
        for (const key in delegatedListener.delegates) {
            const delegate = delegatedListener.delegates[key];
            delegatedListener.delegates[key] = (...args) => {
                this._removeDelegatedListener(type, layerIds, listener);
                delegate(...args);
            };
        }
        this._saveDelegatedListener(type, delegatedListener);
        for (const event in delegatedListener.delegates) {
            this.once(event, delegatedListener.delegates[event]);
        }
        return this;
    }
    off(type, layerIdsOrListener, listener) {
        if (listener === undefined) {
            return super.off(type, layerIdsOrListener);
        }
        const layerIds = typeof layerIdsOrListener === 'string' ? [layerIdsOrListener] : layerIdsOrListener;
        this._removeDelegatedListener(type, layerIds, listener);
        return this;
    }
    queryRenderedFeatures(geometryOrOptions, options) {
        if (!this.style) {
            return [];
        }
        let queryGeometry;
        const isGeometry = geometryOrOptions instanceof Point || Array.isArray(geometryOrOptions);
        const geometry = isGeometry ? geometryOrOptions : [[0, 0], [this.transform.width, this.transform.height]];
        options = options || (isGeometry ? {} : geometryOrOptions) || {};
        if (geometry instanceof Point || typeof geometry[0] === 'number') {
            queryGeometry = [Point.convert(geometry)];
        }
        else {
            const tl = Point.convert(geometry[0]);
            const br = Point.convert(geometry[1]);
            queryGeometry = [tl, new Point(br.x, tl.y), br, new Point(tl.x, br.y), tl];
        }
        return this.style.queryRenderedFeatures(queryGeometry, options, this.transform);
    }
    querySourceFeatures(sourceId, parameters) {
        return this.style.querySourceFeatures(sourceId, parameters);
    }
    setStyle(style, options) {
        options = extend({}, {
            localIdeographFontFamily: this._localIdeographFontFamily,
            validate: this._validateStyle
        }, options);
        if ((options.diff !== false && options.localIdeographFontFamily === this._localIdeographFontFamily) && this.style && style) {
            this._diffStyle(style, options);
            return this;
        }
        else {
            this._localIdeographFontFamily = options.localIdeographFontFamily;
            return this._updateStyle(style, options);
        }
    }
    setTransformRequest(transformRequest) {
        this._requestManager.setTransformRequest(transformRequest);
        return this;
    }
    _getUIString(key) {
        const str = this._locale[key];
        if (str == null) {
            throw new Error(`Missing UI string '${key}'`);
        }
        return str;
    }
    _updateStyle(style, options) {
        var _a, _b;
        if (options.transformStyle && this.style && !this.style._loaded) {
            this.style.once('style.load', () => this._updateStyle(style, options));
            return;
        }
        const previousStyle = this.style && options.transformStyle ? this.style.serialize() : undefined;
        if (this.style) {
            this.style.setEventedParent(null);
            this.style._remove(!style);
        }
        if (!style) {
            (_b = (_a = this.style) === null || _a === void 0 ? void 0 : _a.projection) === null || _b === void 0 ? void 0 : _b.destroy();
            delete this.style;
            return this;
        }
        else {
            this.style = new Style(this, options || {});
        }
        this.style.setEventedParent(this, { style: this.style });
        if (typeof style === 'string') {
            this.style.loadURL(style, options, previousStyle);
        }
        else {
            this.style.loadJSON(style, options, previousStyle);
        }
        return this;
    }
    _lazyInitEmptyStyle() {
        if (!this.style) {
            this.style = new Style(this, {});
            this.style.setEventedParent(this, { style: this.style });
            this.style.loadEmpty();
        }
    }
    _diffStyle(style, options) {
        if (typeof style === 'string') {
            const url = style;
            const request = this._requestManager.transformRequest(url, "Style");
            getJSON(request, new AbortController()).then((response) => {
                this._updateDiff(response.data, options);
            }).catch((error) => {
                if (error) {
                    this.fire(new ErrorEvent(error));
                }
            });
        }
        else if (typeof style === 'object') {
            this._updateDiff(style, options);
        }
    }
    _updateDiff(style, options) {
        try {
            if (this.style.setState(style, options)) {
                this._update(true);
            }
        }
        catch (e) {
            warnOnce(`Unable to perform style diff: ${e.message || e.error || e}.  Rebuilding the style from scratch.`);
            this._updateStyle(style, options);
        }
    }
    getStyle() {
        if (this.style) {
            return this.style.serialize();
        }
    }
    isStyleLoaded() {
        if (!this.style)
            return warnOnce('There is no style added to the map.');
        return this.style.loaded();
    }
    addSource(id, source) {
        this._lazyInitEmptyStyle();
        this.style.addSource(id, source);
        return this._update(true);
    }
    isSourceLoaded(id) {
        const source = this.style && this.style.sourceCaches[id];
        if (source === undefined) {
            this.fire(new ErrorEvent(new Error(`There is no source with ID '${id}'`)));
            return;
        }
        return source.loaded();
    }
    setTerrain(options) {
        this.style._checkLoaded();
        if (this._terrainDataCallback)
            this.style.off('data', this._terrainDataCallback);
        if (!options) {
            if (this.terrain)
                this.terrain.sourceCache.destruct();
            this.terrain = null;
            if (this.painter.renderToTexture)
                this.painter.renderToTexture.destruct();
            this.painter.renderToTexture = null;
            this.transform.setMinElevationForCurrentTile(0);
            if (this._centerClampedToGround) {
                this.transform.setElevation(0);
            }
        }
        else {
            const sourceCache = this.style.sourceCaches[options.source];
            if (!sourceCache)
                throw new Error(`cannot load terrain, because there exists no source with ID: ${options.source}`);
            if (this.terrain === null)
                sourceCache.reload();
            for (const index in this.style._layers) {
                const thisLayer = this.style._layers[index];
                if (thisLayer.type === 'hillshade' && thisLayer.source === options.source) {
                    warnOnce('You are using the same source for a hillshade layer and for 3D terrain. Please consider using two separate sources to improve rendering quality.');
                }
                if (thisLayer.type === 'color-relief' && thisLayer.source === options.source) {
                    warnOnce('You are using the same source for a color-relief layer and for 3D terrain. Please consider using two separate sources to improve rendering quality.');
                }
            }
            this.terrain = new Terrain(this.painter, sourceCache, options);
            this.painter.renderToTexture = new RenderToTexture(this.painter, this.terrain);
            this.transform.setMinElevationForCurrentTile(this.terrain.getMinTileElevationForLngLatZoom(this.transform.center, this.transform.tileZoom));
            this.transform.setElevation(this.terrain.getElevationForLngLatZoom(this.transform.center, this.transform.tileZoom));
            this._terrainDataCallback = e => {
                var _a;
                if (e.dataType === 'style') {
                    this.terrain.sourceCache.freeRtt();
                }
                else if (e.dataType === 'source' && e.tile) {
                    if (e.sourceId === options.source && !this._elevationFreeze) {
                        this.transform.setMinElevationForCurrentTile(this.terrain.getMinTileElevationForLngLatZoom(this.transform.center, this.transform.tileZoom));
                        if (this._centerClampedToGround) {
                            this.transform.setElevation(this.terrain.getElevationForLngLatZoom(this.transform.center, this.transform.tileZoom));
                        }
                    }
                    if (((_a = e.source) === null || _a === void 0 ? void 0 : _a.type) === 'image') {
                        this.terrain.sourceCache.freeRtt();
                    }
                    else {
                        this.terrain.sourceCache.freeRtt(e.tile.tileID);
                    }
                }
            };
            this.style.on('data', this._terrainDataCallback);
        }
        this.fire(new Event('terrain', { terrain: options }));
        return this;
    }
    getTerrain() {
        var _a, _b;
        return (_b = (_a = this.terrain) === null || _a === void 0 ? void 0 : _a.options) !== null && _b !== void 0 ? _b : null;
    }
    areTilesLoaded() {
        const sources = this.style && this.style.sourceCaches;
        for (const id in sources) {
            const source = sources[id];
            const tiles = source._tiles;
            for (const t in tiles) {
                const tile = tiles[t];
                if (!(tile.state === 'loaded' || tile.state === 'errored'))
                    return false;
            }
        }
        return true;
    }
    removeSource(id) {
        this.style.removeSource(id);
        return this._update(true);
    }
    getSource(id) {
        return this.style.getSource(id);
    }
    setSourceTileLodParams(maxZoomLevelsOnScreen, tileCountMaxMinRatio, sourceId) {
        if (sourceId) {
            const source = this.getSource(sourceId);
            if (!source) {
                throw new Error(`There is no source with ID "${sourceId}", cannot set LOD parameters`);
            }
            source.calculateTileZoom = createCalculateTileZoomFunction(Math.max(1, maxZoomLevelsOnScreen), Math.max(1, tileCountMaxMinRatio));
        }
        else {
            for (const id in this.style.sourceCaches) {
                this.style.sourceCaches[id].getSource().calculateTileZoom = createCalculateTileZoomFunction(Math.max(1, maxZoomLevelsOnScreen), Math.max(1, tileCountMaxMinRatio));
            }
        }
        this._update(true);
        return this;
    }
    refreshTiles(sourceId, tileIds) {
        const sourceCache = this.style.sourceCaches[sourceId];
        if (!sourceCache) {
            throw new Error(`There is no source cache with ID "${sourceId}", cannot refresh tile`);
        }
        if (tileIds === undefined) {
            sourceCache.reload(true);
        }
        else {
            sourceCache.refreshTiles(tileIds.map((tileId) => { return new CanonicalTileID(tileId.z, tileId.x, tileId.y); }));
        }
    }
    addImage(id, image, options = {}) {
        const { pixelRatio = 1, sdf = false, stretchX, stretchY, content, textFitWidth, textFitHeight } = options;
        this._lazyInitEmptyStyle();
        const version = 0;
        if (image instanceof HTMLImageElement || isImageBitmap(image)) {
            const { width, height, data } = browser.getImageData(image);
            this.style.addImage(id, { data: new RGBAImage({ width, height }, data), pixelRatio, stretchX, stretchY, content, textFitWidth, textFitHeight, sdf, version });
        }
        else if (image.width === undefined || image.height === undefined) {
            return this.fire(new ErrorEvent(new Error('Invalid arguments to map.addImage(). The second argument must be an `HTMLImageElement`, `ImageData`, `ImageBitmap`, ' +
                'or object with `width`, `height`, and `data` properties with the same format as `ImageData`')));
        }
        else {
            const { width, height, data } = image;
            const userImage = image;
            this.style.addImage(id, {
                data: new RGBAImage({ width, height }, new Uint8Array(data)),
                pixelRatio,
                stretchX,
                stretchY,
                content,
                textFitWidth,
                textFitHeight,
                sdf,
                version,
                userImage
            });
            if (userImage.onAdd) {
                userImage.onAdd(this, id);
            }
            return this;
        }
    }
    updateImage(id, image) {
        const existingImage = this.style.getImage(id);
        if (!existingImage) {
            return this.fire(new ErrorEvent(new Error('The map has no image with that id. If you are adding a new image use `map.addImage(...)` instead.')));
        }
        const imageData = (image instanceof HTMLImageElement || isImageBitmap(image)) ?
            browser.getImageData(image) :
            image;
        const { width, height, data } = imageData;
        if (width === undefined || height === undefined) {
            return this.fire(new ErrorEvent(new Error('Invalid arguments to map.updateImage(). The second argument must be an `HTMLImageElement`, `ImageData`, `ImageBitmap`, ' +
                'or object with `width`, `height`, and `data` properties with the same format as `ImageData`')));
        }
        if (width !== existingImage.data.width || height !== existingImage.data.height) {
            return this.fire(new ErrorEvent(new Error('The width and height of the updated image must be that same as the previous version of the image')));
        }
        const copy = !(image instanceof HTMLImageElement || isImageBitmap(image));
        existingImage.data.replace(data, copy);
        this.style.updateImage(id, existingImage);
        return this;
    }
    getImage(id) {
        return this.style.getImage(id);
    }
    hasImage(id) {
        if (!id) {
            this.fire(new ErrorEvent(new Error('Missing required image id')));
            return false;
        }
        return !!this.style.getImage(id);
    }
    removeImage(id) {
        this.style.removeImage(id);
    }
    loadImage(url) {
        return ImageRequest.getImage(this._requestManager.transformRequest(url, "Image"), new AbortController());
    }
    listImages() {
        return this.style.listImages();
    }
    addLayer(layer, beforeId) {
        this._lazyInitEmptyStyle();
        this.style.addLayer(layer, beforeId);
        return this._update(true);
    }
    moveLayer(id, beforeId) {
        this.style.moveLayer(id, beforeId);
        return this._update(true);
    }
    removeLayer(id) {
        this.style.removeLayer(id);
        return this._update(true);
    }
    getLayer(id) {
        return this.style.getLayer(id);
    }
    getLayersOrder() {
        return this.style.getLayersOrder();
    }
    setLayerZoomRange(layerId, minzoom, maxzoom) {
        this.style.setLayerZoomRange(layerId, minzoom, maxzoom);
        return this._update(true);
    }
    setFilter(layerId, filter, options = {}) {
        this.style.setFilter(layerId, filter, options);
        return this._update(true);
    }
    getFilter(layerId) {
        return this.style.getFilter(layerId);
    }
    setPaintProperty(layerId, name, value, options = {}) {
        this.style.setPaintProperty(layerId, name, value, options);
        return this._update(true);
    }
    getPaintProperty(layerId, name) {
        return this.style.getPaintProperty(layerId, name);
    }
    setLayoutProperty(layerId, name, value, options = {}) {
        this.style.setLayoutProperty(layerId, name, value, options);
        return this._update(true);
    }
    getLayoutProperty(layerId, name) {
        return this.style.getLayoutProperty(layerId, name);
    }
    setGlyphs(glyphsUrl, options = {}) {
        this._lazyInitEmptyStyle();
        this.style.setGlyphs(glyphsUrl, options);
        return this._update(true);
    }
    getGlyphs() {
        return this.style.getGlyphsUrl();
    }
    addSprite(id, url, options = {}) {
        this._lazyInitEmptyStyle();
        this.style.addSprite(id, url, options, (err) => {
            if (!err) {
                this._update(true);
            }
        });
        return this;
    }
    removeSprite(id) {
        this._lazyInitEmptyStyle();
        this.style.removeSprite(id);
        return this._update(true);
    }
    getSprite() {
        return this.style.getSprite();
    }
    setSprite(spriteUrl, options = {}) {
        this._lazyInitEmptyStyle();
        this.style.setSprite(spriteUrl, options, (err) => {
            if (!err) {
                this._update(true);
            }
        });
        return this;
    }
    setLight(light, options = {}) {
        this._lazyInitEmptyStyle();
        this.style.setLight(light, options);
        return this._update(true);
    }
    getLight() {
        return this.style.getLight();
    }
    setSky(sky, options = {}) {
        this._lazyInitEmptyStyle();
        this.style.setSky(sky, options);
        return this._update(true);
    }
    getSky() {
        return this.style.getSky();
    }
    setFeatureState(feature, state) {
        this.style.setFeatureState(feature, state);
        return this._update();
    }
    removeFeatureState(target, key) {
        this.style.removeFeatureState(target, key);
        return this._update();
    }
    getFeatureState(feature) {
        return this.style.getFeatureState(feature);
    }
    getContainer() {
        return this._container;
    }
    getCanvasContainer() {
        return this._canvasContainer;
    }
    getCanvas() {
        return this._canvas;
    }
    _containerDimensions() {
        let width = 0;
        let height = 0;
        if (this._container) {
            width = this._container.clientWidth || 400;
            height = this._container.clientHeight || 300;
        }
        return [width, height];
    }
    _setupContainer() {
        const container = this._container;
        container.classList.add('maplibregl-map');
        const canvasContainer = this._canvasContainer = DOM.create('div', 'maplibregl-canvas-container', container);
        if (this._interactive) {
            canvasContainer.classList.add('maplibregl-interactive');
        }
        this._canvas = DOM.create('canvas', 'maplibregl-canvas', canvasContainer);
        this._canvas.addEventListener('webglcontextlost', this._contextLost, false);
        this._canvas.addEventListener('webglcontextrestored', this._contextRestored, false);
        this._canvas.setAttribute('tabindex', this._interactive ? '0' : '-1');
        this._canvas.setAttribute('aria-label', this._getUIString('Map.Title'));
        this._canvas.setAttribute('role', 'region');
        const dimensions = this._containerDimensions();
        const clampedPixelRatio = this._getClampedPixelRatio(dimensions[0], dimensions[1]);
        this._resizeCanvas(dimensions[0], dimensions[1], clampedPixelRatio);
        const controlContainer = this._controlContainer = DOM.create('div', 'maplibregl-control-container', container);
        const positions = this._controlPositions = {};
        ['top-left', 'top-right', 'bottom-left', 'bottom-right'].forEach((positionName) => {
            positions[positionName] = DOM.create('div', `maplibregl-ctrl-${positionName} `, controlContainer);
        });
        this._container.addEventListener('scroll', this._onMapScroll, false);
    }
    _resizeCanvas(width, height, pixelRatio) {
        this._canvas.width = Math.floor(pixelRatio * width);
        this._canvas.height = Math.floor(pixelRatio * height);
        this._canvas.style.width = `${width}px`;
        this._canvas.style.height = `${height}px`;
    }
    _setupPainter() {
        const attributes = Object.assign(Object.assign({}, this._canvasContextAttributes), { alpha: true, depth: true, stencil: true, premultipliedAlpha: true });
        let webglcontextcreationerrorDetailObject = null;
        this._canvas.addEventListener('webglcontextcreationerror', (args) => {
            webglcontextcreationerrorDetailObject = { requestedAttributes: attributes };
            if (args) {
                webglcontextcreationerrorDetailObject.statusMessage = args.statusMessage;
                webglcontextcreationerrorDetailObject.type = args.type;
            }
        }, { once: true });
        let gl = null;
        if (this._canvasContextAttributes.contextType) {
            gl = this._canvas.getContext(this._canvasContextAttributes.contextType, attributes);
        }
        else {
            gl = this._canvas.getContext('webgl2', attributes) || this._canvas.getContext('webgl', attributes);
        }
        if (!gl) {
            const msg = 'Failed to initialize WebGL';
            if (webglcontextcreationerrorDetailObject) {
                webglcontextcreationerrorDetailObject.message = msg;
                throw new Error(JSON.stringify(webglcontextcreationerrorDetailObject));
            }
            else {
                throw new Error(msg);
            }
        }
        this.painter = new Painter(gl, this.transform);
        webpSupported.testSupport(gl);
    }
    migrateProjection(newTransform, newCameraHelper) {
        super.migrateProjection(newTransform, newCameraHelper);
        this.painter.transform = newTransform;
        this.fire(new Event('projectiontransition', {
            newProjection: this.style.projection.name,
        }));
    }
    loaded() {
        return !this._styleDirty && !this._sourcesDirty && !!this.style && this.style.loaded();
    }
    _update(updateStyle) {
        if (!this.style || !this.style._loaded)
            return this;
        this._styleDirty = this._styleDirty || updateStyle;
        this._sourcesDirty = true;
        this.triggerRepaint();
        return this;
    }
    _requestRenderFrame(callback) {
        this._update();
        return this._renderTaskQueue.add(callback);
    }
    _cancelRenderFrame(id) {
        this._renderTaskQueue.remove(id);
    }
    _render(paintStartTimeStamp) {
        var _a, _b, _c, _d, _e;
        const fadeDuration = this._idleTriggered ? this._fadeDuration : 0;
        const isGlobeRendering = ((_a = this.style.projection) === null || _a === void 0 ? void 0 : _a.transitionState) > 0;
        this.painter.context.setDirty();
        this.painter.setBaseState();
        this._renderTaskQueue.run(paintStartTimeStamp);
        if (this._removed)
            return;
        let crossFading = false;
        if (this.style && this._styleDirty) {
            this._styleDirty = false;
            const zoom = this.transform.zoom;
            const now = browser.now();
            this.style.zoomHistory.update(zoom, now);
            const parameters = new EvaluationParameters(zoom, {
                now,
                fadeDuration,
                zoomHistory: this.style.zoomHistory,
                transition: this.style.getTransition()
            });
            const factor = parameters.crossFadingFactor();
            if (factor !== 1 || factor !== this._crossFadingFactor) {
                crossFading = true;
                this._crossFadingFactor = factor;
            }
            this.style.update(parameters);
        }
        const globeRenderingChanged = ((_b = this.style.projection) === null || _b === void 0 ? void 0 : _b.transitionState) > 0 !== isGlobeRendering;
        (_c = this.style.projection) === null || _c === void 0 ? void 0 : _c.setErrorQueryLatitudeDegrees(this.transform.center.lat);
        this.transform.setTransitionState((_d = this.style.projection) === null || _d === void 0 ? void 0 : _d.transitionState, (_e = this.style.projection) === null || _e === void 0 ? void 0 : _e.latitudeErrorCorrectionRadians);
        if (this.style && (this._sourcesDirty || globeRenderingChanged)) {
            this._sourcesDirty = false;
            this.style._updateSources(this.transform);
        }
        if (this.terrain) {
            this.terrain.sourceCache.update(this.transform, this.terrain);
            this.transform.setMinElevationForCurrentTile(this.terrain.getMinTileElevationForLngLatZoom(this.transform.center, this.transform.tileZoom));
            if (!this._elevationFreeze && this._centerClampedToGround) {
                this.transform.setElevation(this.terrain.getElevationForLngLatZoom(this.transform.center, this.transform.tileZoom));
            }
        }
        else {
            this.transform.setMinElevationForCurrentTile(0);
            if (this._centerClampedToGround) {
                this.transform.setElevation(0);
            }
        }
        this._placementDirty = this.style && this.style._updatePlacement(this.transform, this.showCollisionBoxes, fadeDuration, this._crossSourceCollisions, globeRenderingChanged);
        this.painter.render(this.style, {
            showTileBoundaries: this.showTileBoundaries,
            showOverdrawInspector: this._showOverdrawInspector,
            rotating: this.isRotating(),
            zooming: this.isZooming(),
            moving: this.isMoving(),
            fadeDuration,
            showPadding: this.showPadding,
        });
        this.fire(new Event('render'));
        if (this.loaded() && !this._loaded) {
            this._loaded = true;
            PerformanceUtils.mark(PerformanceMarkers.load);
            this.fire(new Event('load'));
        }
        if (this.style && (this.style.hasTransitions() || crossFading)) {
            this._styleDirty = true;
        }
        if (this.style && !this._placementDirty) {
            this.style._releaseSymbolFadeTiles();
        }
        const somethingDirty = this._sourcesDirty || this._styleDirty || this._placementDirty;
        if (somethingDirty || this._repaint) {
            this.triggerRepaint();
        }
        else if (!this.isMoving() && this.loaded()) {
            this.fire(new Event('idle'));
        }
        if (this._loaded && !this._fullyLoaded && !somethingDirty) {
            this._fullyLoaded = true;
            PerformanceUtils.mark(PerformanceMarkers.fullLoad);
        }
        return this;
    }
    redraw() {
        if (this.style) {
            if (this._frameRequest) {
                this._frameRequest.abort();
                this._frameRequest = null;
            }
            this._render(0);
        }
        return this;
    }
    remove() {
        var _a;
        if (this._hash)
            this._hash.remove();
        for (const control of this._controls)
            control.onRemove(this);
        this._controls = [];
        if (this._frameRequest) {
            this._frameRequest.abort();
            this._frameRequest = null;
        }
        this._renderTaskQueue.clear();
        this.painter.destroy();
        this.handlers.destroy();
        delete this.handlers;
        this.setStyle(null);
        if (typeof window !== 'undefined') {
            removeEventListener('online', this._onWindowOnline, false);
        }
        ImageRequest.removeThrottleControl(this._imageQueueHandle);
        (_a = this._resizeObserver) === null || _a === void 0 ? void 0 : _a.disconnect();
        const extension = this.painter.context.gl.getExtension('WEBGL_lose_context');
        if (extension === null || extension === void 0 ? void 0 : extension.loseContext)
            extension.loseContext();
        this._canvas.removeEventListener('webglcontextrestored', this._contextRestored, false);
        this._canvas.removeEventListener('webglcontextlost', this._contextLost, false);
        DOM.remove(this._canvasContainer);
        DOM.remove(this._controlContainer);
        this._container.removeEventListener('scroll', this._onMapScroll, false);
        this._container.classList.remove('maplibregl-map');
        PerformanceUtils.clearMetrics();
        this._removed = true;
        this.fire(new Event('remove'));
    }
    triggerRepaint() {
        if (this.style && !this._frameRequest) {
            this._frameRequest = new AbortController();
            browser.frame(this._frameRequest, (paintStartTimeStamp) => {
                PerformanceUtils.frame(paintStartTimeStamp);
                this._frameRequest = null;
                try {
                    this._render(paintStartTimeStamp);
                }
                catch (error) {
                    if (!isAbortError(error) && !isFramebufferNotCompleteError(error)) {
                        throw error;
                    }
                }
            }, () => { });
        }
    }
    get showTileBoundaries() { return !!this._showTileBoundaries; }
    set showTileBoundaries(value) {
        if (this._showTileBoundaries === value)
            return;
        this._showTileBoundaries = value;
        this._update();
    }
    get showPadding() { return !!this._showPadding; }
    set showPadding(value) {
        if (this._showPadding === value)
            return;
        this._showPadding = value;
        this._update();
    }
    get showCollisionBoxes() { return !!this._showCollisionBoxes; }
    set showCollisionBoxes(value) {
        if (this._showCollisionBoxes === value)
            return;
        this._showCollisionBoxes = value;
        if (value) {
            this.style._generateCollisionBoxes();
        }
        else {
            this._update();
        }
    }
    get showOverdrawInspector() { return !!this._showOverdrawInspector; }
    set showOverdrawInspector(value) {
        if (this._showOverdrawInspector === value)
            return;
        this._showOverdrawInspector = value;
        this._update();
    }
    get repaint() { return !!this._repaint; }
    set repaint(value) {
        if (this._repaint !== value) {
            this._repaint = value;
            this.triggerRepaint();
        }
    }
    get vertices() { return !!this._vertices; }
    set vertices(value) { this._vertices = value; this._update(); }
    get version() {
        return version;
    }
    getCameraTargetElevation() {
        return this.transform.elevation;
    }
    getProjection() { return this.style.getProjection(); }
    setProjection(projection) {
        this._lazyInitEmptyStyle();
        this.style.setProjection(projection);
        return this._update(true);
    }
}
//# sourceMappingURL=map.js.map