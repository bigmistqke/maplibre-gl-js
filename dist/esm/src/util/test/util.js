import { vi, expect } from 'vitest';
import { Map } from '../../ui/map';
import { extend } from '../../util/util';
import { Evented } from '../evented';
import { MercatorTransform } from '../../geo/projection/mercator_transform';
import { RequestManager } from '../request_manager';
import { Frustum } from '../primitives/frustum';
import { mat4 } from 'gl-matrix';
export class StubMap extends Evented {
    constructor() {
        super();
        this.transform = new MercatorTransform();
        this._requestManager = new RequestManager();
    }
    _getMapId() {
        return 1;
    }
    getPixelRatio() {
        return 1;
    }
    setTerrain(terrain) { this._terrain = terrain; }
    getTerrain() { return this._terrain; }
    migrateProjection(newTransform) {
        newTransform.apply(this.transform);
        this.transform = newTransform;
    }
}
export function createMap(options) {
    const container = window.document.createElement('div');
    const defaultOptions = {
        container,
        interactive: false,
        attributionControl: false,
        maplibreLogo: false,
        trackResize: true,
        style: {
            'version': 8,
            'sources': {},
            'layers': []
        }
    };
    Object.defineProperty(container, 'clientWidth', { value: 200, configurable: true });
    Object.defineProperty(container, 'clientHeight', { value: 200, configurable: true });
    if (options === null || options === void 0 ? void 0 : options.deleteStyle)
        delete defaultOptions.style;
    const map = new Map(extend(defaultOptions, options));
    return map;
}
export function equalWithPrecision(test, expected, actual, multiplier, message, extra) {
    message = message || `should be equal to within ${multiplier}`;
    const expectedRounded = Math.round(expected / multiplier) * multiplier;
    const actualRounded = Math.round(actual / multiplier) * multiplier;
    return test.equal(expectedRounded, actualRounded, message, extra);
}
export function setPerformance() {
    window.performance.mark = vi.fn();
    window.performance.clearMeasures = vi.fn();
    window.performance.clearMarks = vi.fn();
}
export function setMatchMedia() {
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        })),
    });
}
function setResizeObserver() {
    global.ResizeObserver = vi.fn().mockImplementation(() => ({
        observe: vi.fn(),
        unobserve: vi.fn(),
        disconnect: vi.fn(),
    }));
}
export function beforeMapTest() {
    setPerformance();
    setMatchMedia();
    setResizeObserver();
    WebGLRenderingContext.prototype.bindVertexArray = WebGLRenderingContext.prototype.getExtension('OES_vertex_array_object').bindVertexArrayOES;
    WebGLRenderingContext.prototype.createVertexArray = WebGLRenderingContext.prototype.getExtension('OES_vertex_array_object').createVertexArrayOES;
    if (!WebGLRenderingContext.prototype.drawingBufferHeight && !WebGLRenderingContext.prototype.drawingBufferWidth) {
        Object.defineProperty(WebGLRenderingContext.prototype, 'drawingBufferWidth', {
            get: vi.fn(),
            configurable: true,
        });
        Object.defineProperty(WebGLRenderingContext.prototype, 'drawingBufferHeight', {
            get: vi.fn(),
            configurable: true,
        });
    }
}
export function getWrapDispatcher() {
    const wrapDispatcher = (actor) => {
        return {
            getActor() {
                return actor;
            }
        };
    };
    return wrapDispatcher;
}
export function getMockDispatcher() {
    const wrapDispatcher = getWrapDispatcher();
    const mockDispatcher = wrapDispatcher({
        sendAsync() { return Promise.resolve({}); },
    });
    return mockDispatcher;
}
export function stubAjaxGetImage(createImageBitmap) {
    global.createImageBitmap = createImageBitmap;
    global.URL.revokeObjectURL = () => { };
    global.URL.createObjectURL = (_) => { return null; };
    Object.defineProperty(global.Image.prototype, 'src', {
        set(url) {
            if (url === 'error') {
                this.onerror();
            }
            else if (this.onload) {
                this.onload();
            }
        }
    });
}
export function bufferToArrayBuffer(data) {
    const newBuffer = new ArrayBuffer(data.buffer.byteLength);
    const view = new Uint8Array(newBuffer);
    data.copy(view);
    return view.buffer;
}
export const sleep = (milliseconds = 0) => {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
};
export function waitForMetadataEvent(source) {
    return new Promise((resolve) => {
        source.on('data', (e) => {
            if (e.sourceDataType === 'metadata') {
                resolve();
            }
        });
    });
}
export function createStyleSource() {
    return {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: []
        }
    };
}
export function createStyle() {
    return {
        version: 8,
        center: [-73.9749, 40.7736],
        zoom: 12.5,
        bearing: 29,
        pitch: 50,
        sources: {},
        layers: []
    };
}
export function expectToBeCloseToArray(actual, expected, precision) {
    expect(actual).toHaveLength(expected.length);
    for (let i = 0; i < expected.length; i++) {
        expect(actual[i]).toBeCloseTo(expected[i], precision);
    }
}
export function createTerrain() {
    return {
        pointCoordinate: () => null,
        getElevationForLngLatZoom: () => 1000,
        getMinTileElevationForLngLatZoom: () => 0,
        getFramebuffer: () => ({}),
        getCoordsTexture: () => ({}),
        depthAtPoint: () => .9,
        sourceCache: {
            update: () => { },
            getRenderableTiles: () => [],
            anyTilesAfterTime: () => false
        }
    };
}
export function createFramebuffer() {
    return {
        colorAttachment: {
            get: () => null,
            set: () => { }
        },
        depthAttachment: {
            get: () => null,
            set: () => { }
        },
        destroy: () => { }
    };
}
export function waitForEvent(evented, eventName, predicate) {
    return new Promise((resolve) => {
        const listener = (e) => {
            if (predicate(e)) {
                resolve(e);
            }
        };
        evented.on(eventName, listener);
    });
}
export function createTestCameraFrustum(fovy, aspectRatio, zNear, zFar, elevation, rotation) {
    const proj = new Float64Array(16);
    const invProj = new Float64Array(16);
    mat4.perspective(proj, fovy, aspectRatio, zNear, zFar);
    mat4.scale(proj, proj, [1, -1, 1]);
    mat4.translate(proj, proj, [0, 0, elevation]);
    mat4.rotateZ(proj, proj, rotation);
    mat4.invert(invProj, proj);
    return Frustum.fromInvProjectionMatrix(invProj, 1.0, 0.0);
}
;
//# sourceMappingURL=util.js.map