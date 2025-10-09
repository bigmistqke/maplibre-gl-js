import packageJSON from '../package.json' with { type: 'json' };
import { Map } from './ui/map';
import { Camera } from './ui/camera';
import { NavigationControl } from './ui/control/navigation_control';
import { GeolocateControl } from './ui/control/geolocate_control';
import { AttributionControl, defaultAttributionControlOptions } from './ui/control/attribution_control';
import { LogoControl } from './ui/control/logo_control';
import { ScaleControl } from './ui/control/scale_control';
import { FullscreenControl } from './ui/control/fullscreen_control';
import { TerrainControl } from './ui/control/terrain_control';
import { GlobeControl } from './ui/control/globe_control';
import { Popup } from './ui/popup';
import { Marker } from './ui/marker';
import { Style } from './style/style';
import { LngLat } from './geo/lng_lat';
import { LngLatBounds } from './geo/lng_lat_bounds';
import Point from '@mapbox/point-geometry';
import { MercatorCoordinate } from './geo/mercator_coordinate';
import { Evented, ErrorEvent, Event } from './util/evented';
import { config } from './util/config';
import { rtlMainThreadPluginFactory } from './source/rtl_text_plugin_main_thread';
import { WorkerPool } from './util/worker_pool';
import { prewarm, clearPrewarmedResources } from './util/global_worker_pool';
import { AJAXError, getJSON } from './util/ajax';
import { addSourceType } from './source/source';
import { addProtocol, removeProtocol } from './source/protocol_crud';
import { getGlobalDispatcher } from './util/dispatcher';
import { EdgeInsets } from './geo/edge_insets';
import { MapWheelEvent, MapTouchEvent, MapMouseEvent } from './ui/events';
import { BoxZoomHandler } from './ui/handler/box_zoom';
import { DragRotateHandler } from './ui/handler/shim/drag_rotate';
import { DragPanHandler } from './ui/handler/shim/drag_pan';
import { ScrollZoomHandler } from './ui/handler/scroll_zoom';
import { TwoFingersTouchZoomRotateHandler } from './ui/handler/shim/two_fingers_touch';
import { Hash } from './ui/hash';
import { CooperativeGesturesHandler } from './ui/handler/cooperative_gestures';
import { DoubleClickZoomHandler } from './ui/handler/shim/dblclick_zoom';
import { KeyboardHandler } from './ui/handler/keyboard';
import { TwoFingersTouchPitchHandler, TwoFingersTouchRotateHandler, TwoFingersTouchZoomHandler } from './ui/handler/two_fingers_touch';
import { createTileMesh } from './util/create_tile_mesh';
import { HandlerManager } from './ui/handler_manager';
import { extend, isImageBitmap, pick, uniqueId, warnOnce } from './util/util';
import { coveringTiles, createCalculateTileZoomFunction } from './geo/projection/covering_tiles';
import { RequestManager } from './util/request_manager';
import { CanonicalTileID } from './source/tile_id';
import { RGBAImage } from './util/image';
import { Painter } from './render/painter';
import { TaskQueue } from './util/task_queue';
import { defaultLocale } from './ui/default_locale';
import { PerformanceMarkers, PerformanceUtils } from './util/performance';
import { ImageRequest } from './util/image_request';
import { DOM } from './util/dom';
import { webpSupported } from './util/webp_supported';
import { MercatorTransform } from './geo/projection/mercator_transform';
import { MercatorCameraHelper } from './geo/projection/mercator_camera_helper';
import { browser } from './util/browser';
import { EvaluationParameters } from './style/evaluation_parameters';
import { isAbortError } from './util/abort_error';
import { isFramebufferNotCompleteError } from './util/framebuffer_error';
import { RenderToTexture } from './render/render_to_texture';
import { Terrain } from './render/terrain';
import { throttle } from './util/throttle';
import { CanvasSource } from './source/canvas_source';
import { GeoJSONSource } from './source/geojson_source';
import { ImageSource } from './source/image_source';
import { RasterDEMTileSource } from './source/raster_dem_tile_source';
import { RasterTileSource } from './source/raster_tile_source';
import { VectorTileSource } from './source/vector_tile_source';
import { VideoSource } from './source/video_source';
import Worker from './source/worker';
export { registerCanvasSource, registerGeoJSONSource, registerImageSource, registerRasterDEMSource, registerRasterSource, registerVectorSource, registerVideoSource, registerBackground, registerCircle, registerColorRelief, registerFill, registerFillExtrusion, registerHeatmap, registerHillshade, registerLine, registerRaster, registerSymbol, registerUtilityShaders, } from './features';
const version = packageJSON.version;
function setRTLTextPlugin(pluginURL, lazy) {
    return rtlMainThreadPluginFactory().setRTLTextPlugin(pluginURL, lazy);
}
function getRTLTextPluginStatus() {
    return rtlMainThreadPluginFactory().getRTLTextPluginStatus();
}
function getVersion() { return version; }
function getWorkerCount() { return WorkerPool.workerCount; }
function setWorkerCount(count) { WorkerPool.workerCount = count; }
function getMaxParallelImageRequests() { return config.MAX_PARALLEL_IMAGE_REQUESTS; }
function setMaxParallelImageRequests(numRequests) { config.MAX_PARALLEL_IMAGE_REQUESTS = numRequests; }
function getWorkerUrl() { return config.WORKER_URL; }
function setWorkerUrl(value, module = false) {
    config.WORKER_URL = value;
    config.WORKER_IS_MODULE = module;
}
function importScriptInWorkers(workerUrl) { return getGlobalDispatcher().broadcast("IS", workerUrl); }
export { browser, Camera, CanonicalTileID, coveringTiles, createCalculateTileZoomFunction, defaultAttributionControlOptions, defaultLocale, DOM, ErrorEvent, EvaluationParameters, extend, getJSON, HandlerManager, ImageRequest, isAbortError, isFramebufferNotCompleteError, isImageBitmap, MercatorCameraHelper, MercatorTransform, packageJSON, Painter, PerformanceMarkers, PerformanceUtils, pick, RenderToTexture, RequestManager, RGBAImage, TaskQueue, Terrain, throttle, uniqueId, warnOnce, webpSupported, Map, NavigationControl, GeolocateControl, AttributionControl, LogoControl, ScaleControl, FullscreenControl, TerrainControl, GlobeControl, Hash, Popup, Marker, Style, LngLat, LngLatBounds, Point, MercatorCoordinate, Evented, Event, AJAXError, config, CanvasSource, GeoJSONSource, ImageSource, RasterDEMTileSource, RasterTileSource, VectorTileSource, VideoSource, Worker, EdgeInsets, BoxZoomHandler, DragRotateHandler, DragPanHandler, ScrollZoomHandler, TwoFingersTouchZoomRotateHandler, CooperativeGesturesHandler, DoubleClickZoomHandler, KeyboardHandler, TwoFingersTouchZoomHandler, TwoFingersTouchRotateHandler, TwoFingersTouchPitchHandler, MapWheelEvent, MapTouchEvent, MapMouseEvent, setRTLTextPlugin, getRTLTextPluginStatus, prewarm, clearPrewarmedResources, getVersion, getWorkerCount, setWorkerCount, getMaxParallelImageRequests, setMaxParallelImageRequests, getWorkerUrl, setWorkerUrl, addProtocol, removeProtocol, addSourceType, importScriptInWorkers, createTileMesh };
//# sourceMappingURL=core.js.map