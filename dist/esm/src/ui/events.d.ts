import { Event } from '../util/evented';
import Point from '@mapbox/point-geometry';
import type { MapGeoJSONFeature } from '../util/vectortile_to_geojson';
import type { Map } from './map';
import type { LngLat } from '../geo/lng_lat';
import type { ProjectionSpecification, SourceSpecification } from '@maplibre/maplibre-gl-style-spec';
export type MapLayerMouseEvent = MapMouseEvent & {
    features?: MapGeoJSONFeature[];
};
export type MapLayerTouchEvent = MapTouchEvent & {
    features?: MapGeoJSONFeature[];
};
export type MapSourceDataType = 'content' | 'metadata' | 'visibility' | 'idle';
export type MapLayerEventType = {
    click: MapLayerMouseEvent;
    dblclick: MapLayerMouseEvent;
    mousedown: MapLayerMouseEvent;
    mouseup: MapLayerMouseEvent;
    mousemove: MapLayerMouseEvent;
    mouseenter: MapLayerMouseEvent;
    mouseleave: MapLayerMouseEvent;
    mouseover: MapLayerMouseEvent;
    mouseout: MapLayerMouseEvent;
    contextmenu: MapLayerMouseEvent;
    touchstart: MapLayerTouchEvent;
    touchend: MapLayerTouchEvent;
    touchcancel: MapLayerTouchEvent;
};
export type MapEventType = {
    error: ErrorEvent;
    load: MapLibreEvent;
    idle: MapLibreEvent;
    remove: MapLibreEvent;
    render: MapLibreEvent;
    resize: MapLibreEvent;
    webglcontextlost: MapContextEvent;
    webglcontextrestored: MapContextEvent;
    dataloading: MapDataEvent;
    data: MapDataEvent;
    tiledataloading: MapDataEvent;
    sourcedataloading: MapSourceDataEvent;
    styledataloading: MapStyleDataEvent;
    sourcedata: MapSourceDataEvent;
    styledata: MapStyleDataEvent;
    styleimagemissing: MapStyleImageMissingEvent;
    dataabort: MapDataEvent;
    sourcedataabort: MapSourceDataEvent;
    boxzoomcancel: MapLibreZoomEvent;
    boxzoomstart: MapLibreZoomEvent;
    boxzoomend: MapLibreZoomEvent;
    touchcancel: MapTouchEvent;
    touchmove: MapTouchEvent;
    touchend: MapTouchEvent;
    touchstart: MapTouchEvent;
    click: MapMouseEvent;
    contextmenu: MapMouseEvent;
    dblclick: MapMouseEvent;
    mousemove: MapMouseEvent;
    mouseup: MapMouseEvent;
    mousedown: MapMouseEvent;
    mouseout: MapMouseEvent;
    mouseover: MapMouseEvent;
    movestart: MapLibreEvent<MouseEvent | TouchEvent | WheelEvent | undefined>;
    move: MapLibreEvent<MouseEvent | TouchEvent | WheelEvent | undefined>;
    moveend: MapLibreEvent<MouseEvent | TouchEvent | WheelEvent | undefined>;
    zoomstart: MapLibreEvent<MouseEvent | TouchEvent | WheelEvent | undefined>;
    zoom: MapLibreEvent<MouseEvent | TouchEvent | WheelEvent | undefined>;
    zoomend: MapLibreEvent<MouseEvent | TouchEvent | WheelEvent | undefined>;
    rotatestart: MapLibreEvent<MouseEvent | TouchEvent | undefined>;
    rotate: MapLibreEvent<MouseEvent | TouchEvent | undefined>;
    rotateend: MapLibreEvent<MouseEvent | TouchEvent | undefined>;
    dragstart: MapLibreEvent<MouseEvent | TouchEvent | undefined>;
    drag: MapLibreEvent<MouseEvent | TouchEvent | undefined>;
    dragend: MapLibreEvent<MouseEvent | TouchEvent | undefined>;
    pitchstart: MapLibreEvent<MouseEvent | TouchEvent | undefined>;
    pitch: MapLibreEvent<MouseEvent | TouchEvent | undefined>;
    pitchend: MapLibreEvent<MouseEvent | TouchEvent | undefined>;
    wheel: MapWheelEvent;
    terrain: MapTerrainEvent;
    cooperativegestureprevented: MapLibreEvent<WheelEvent | TouchEvent> & {
        gestureType: 'wheel_zoom' | 'touch_pan';
    };
    projectiontransition: MapProjectionEvent;
};
export type MapLibreEvent<TOrig = unknown> = {
    type: keyof MapEventType | keyof MapLayerEventType;
    target: Map;
    originalEvent: TOrig;
};
export type MapStyleDataEvent = MapLibreEvent & {
    dataType: 'style';
};
export type MapSourceDataEvent = MapLibreEvent & {
    dataType: 'source';
    isSourceLoaded: boolean;
    source: SourceSpecification;
    sourceId: string;
    sourceDataType: MapSourceDataType;
    sourceDataChanged?: boolean;
    tile: any;
};
export declare class MapMouseEvent extends Event implements MapLibreEvent<MouseEvent> {
    type: 'mousedown' | 'mouseup' | 'click' | 'dblclick' | 'mousemove' | 'mouseover' | 'mouseenter' | 'mouseleave' | 'mouseout' | 'contextmenu';
    target: Map;
    originalEvent: MouseEvent;
    point: Point;
    lngLat: LngLat;
    preventDefault(): void;
    get defaultPrevented(): boolean;
    _defaultPrevented: boolean;
    constructor(type: string, map: Map, originalEvent: MouseEvent, data?: any);
}
export declare class MapTouchEvent extends Event implements MapLibreEvent<TouchEvent> {
    type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel';
    target: Map;
    originalEvent: TouchEvent;
    lngLat: LngLat;
    point: Point;
    points: Array<Point>;
    lngLats: Array<LngLat>;
    preventDefault(): void;
    get defaultPrevented(): boolean;
    _defaultPrevented: boolean;
    constructor(type: string, map: Map, originalEvent: TouchEvent);
}
export declare class MapWheelEvent extends Event {
    type: 'wheel';
    target: Map;
    originalEvent: WheelEvent;
    preventDefault(): void;
    get defaultPrevented(): boolean;
    _defaultPrevented: boolean;
    constructor(type: string, map: Map, originalEvent: WheelEvent);
}
export type MapLibreZoomEvent = {
    type: 'boxzoomstart' | 'boxzoomend' | 'boxzoomcancel';
    target: Map;
    originalEvent: MouseEvent;
};
export type MapDataEvent = {
    type: string;
    dataType: string;
    sourceDataType: MapSourceDataType;
};
export type MapTerrainEvent = {
    type: 'terrain';
};
export type MapProjectionEvent = {
    type: 'projectiontransition';
    newProjection: ProjectionSpecification['type'];
};
export type MapContextEvent = {
    type: 'webglcontextlost' | 'webglcontextrestored';
    originalEvent: WebGLContextEvent;
};
export type MapStyleImageMissingEvent = MapLibreEvent & {
    type: 'styleimagemissing';
    id: string;
};
//# sourceMappingURL=events.d.ts.map