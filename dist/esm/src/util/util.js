var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import Point from '@mapbox/point-geometry';
import UnitBezier from '@mapbox/unitbezier';
import { isOffscreenCanvasDistorted } from './offscreen_canvas_distorted';
import { mat3, mat4, quat, vec2, vec3 } from 'gl-matrix';
import { pixelsToTileUnits } from '../source/pixels_to_tile_units';
export function createVec4f64() { return new Float64Array(4); }
export function createVec3f64() { return new Float64Array(3); }
export function createMat4f64() { return new Float64Array(16); }
export function createMat4f32() { return new Float32Array(16); }
export function createIdentityMat4f64() {
    const m = new Float64Array(16);
    mat4.identity(m);
    return m;
}
export function createIdentityMat4f32() {
    const m = new Float32Array(16);
    mat4.identity(m);
    return m;
}
export function translatePosition(transform, tile, translate, translateAnchor, inViewportPixelUnitsUnits = false) {
    if (!translate[0] && !translate[1])
        return [0, 0];
    const angle = inViewportPixelUnitsUnits ?
        (translateAnchor === 'map' ? -transform.bearingInRadians : 0) :
        (translateAnchor === 'viewport' ? transform.bearingInRadians : 0);
    if (angle) {
        const sinA = Math.sin(angle);
        const cosA = Math.cos(angle);
        translate = [
            translate[0] * cosA - translate[1] * sinA,
            translate[0] * sinA + translate[1] * cosA
        ];
    }
    return [
        inViewportPixelUnitsUnits ? translate[0] : pixelsToTileUnits(tile, translate[0], transform.zoom),
        inViewportPixelUnitsUnits ? translate[1] : pixelsToTileUnits(tile, translate[1], transform.zoom)
    ];
}
export function pointPlaneSignedDistance(plane, point) {
    return plane[0] * point[0] + plane[1] * point[1] + plane[2] * point[2] + plane[3];
}
export function threePlaneIntersection(plane0, plane1, plane2) {
    const det = mat3.determinant([
        plane0[0], plane0[1], plane0[2],
        plane1[0], plane1[1], plane1[2],
        plane2[0], plane2[1], plane2[2]
    ]);
    if (det === 0) {
        return null;
    }
    const cross12 = vec3.cross([], [plane1[0], plane1[1], plane1[2]], [plane2[0], plane2[1], plane2[2]]);
    const cross20 = vec3.cross([], [plane2[0], plane2[1], plane2[2]], [plane0[0], plane0[1], plane0[2]]);
    const cross01 = vec3.cross([], [plane0[0], plane0[1], plane0[2]], [plane1[0], plane1[1], plane1[2]]);
    const sum = vec3.scale([], cross12, -plane0[3]);
    vec3.add(sum, sum, vec3.scale([], cross20, -plane1[3]));
    vec3.add(sum, sum, vec3.scale([], cross01, -plane2[3]));
    vec3.scale(sum, sum, 1.0 / det);
    return sum;
}
export function rayPlaneIntersection(origin, direction, plane) {
    const dotOriginPlane = origin[0] * plane[0] + origin[1] * plane[1] + origin[2] * plane[2];
    const dotDirectionPlane = direction[0] * plane[0] + direction[1] * plane[1] + direction[2] * plane[2];
    if (dotDirectionPlane === 0) {
        return null;
    }
    return (-dotOriginPlane - plane[3]) / dotDirectionPlane;
}
export function solveQuadratic(a, b, c) {
    const d = b * b - 4 * a * c;
    if (d < 0 || (a === 0 && b === 0)) {
        return null;
    }
    const q = -0.5 * (b + Math.sign(b) * Math.sqrt(d));
    if (Math.abs(q) > 1e-12) {
        return {
            t0: c / q,
            t1: q / a
        };
    }
    else {
        return {
            t0: (-b + Math.sqrt(d)) * 0.5 / a,
            t1: (-b + Math.sqrt(d)) * 0.5 / a
        };
    }
}
export function angleToRotateBetweenVectors2D(vec1x, vec1y, vec2x, vec2y) {
    const length1 = Math.sqrt(vec1x * vec1x + vec1y * vec1y);
    const length2 = Math.sqrt(vec2x * vec2x + vec2y * vec2y);
    vec1x /= length1;
    vec1y /= length1;
    vec2x /= length2;
    vec2y /= length2;
    const dot = vec1x * vec2x + vec1y * vec2y;
    const angle = Math.acos(dot);
    const isVec2RightOfVec1 = (-vec1y * vec2x + vec1x * vec2y) > 0;
    if (isVec2RightOfVec1) {
        return angle;
    }
    else {
        return -angle;
    }
}
export function differenceOfAnglesDegrees(degreesA, degreesB) {
    const a = mod(degreesA, 360);
    const b = mod(degreesB, 360);
    const diff1 = b - a;
    const diff2 = (b > a) ? (diff1 - 360) : (diff1 + 360);
    if (Math.abs(diff1) < Math.abs(diff2)) {
        return diff1;
    }
    else {
        return diff2;
    }
}
export function differenceOfAnglesRadians(degreesA, degreesB) {
    const a = mod(degreesA, Math.PI * 2);
    const b = mod(degreesB, Math.PI * 2);
    const diff1 = b - a;
    const diff2 = (b > a) ? (diff1 - Math.PI * 2) : (diff1 + Math.PI * 2);
    if (Math.abs(diff1) < Math.abs(diff2)) {
        return diff1;
    }
    else {
        return diff2;
    }
}
export function distanceOfAnglesDegrees(degreesA, degreesB) {
    const a = mod(degreesA, 360);
    const b = mod(degreesB, 360);
    return Math.min(Math.abs(a - b), Math.abs(a - b + 360), Math.abs(a - b - 360));
}
export function distanceOfAnglesRadians(radiansA, radiansB) {
    const a = mod(radiansA, Math.PI * 2);
    const b = mod(radiansB, Math.PI * 2);
    return Math.min(Math.abs(a - b), Math.abs(a - b + Math.PI * 2), Math.abs(a - b - Math.PI * 2));
}
export function mod(n, m) {
    return ((n % m) + m) % m;
}
export function remapSaturate(value, oldRangeMin, oldRangeMax, newRangeMin, newRangeMax) {
    const inOldRange = clamp((value - oldRangeMin) / (oldRangeMax - oldRangeMin), 0.0, 1.0);
    return lerp(newRangeMin, newRangeMax, inOldRange);
}
export function lerp(a, b, mix) {
    return a * (1.0 - mix) + b * mix;
}
export function getAABB(points) {
    let tlX = Infinity;
    let tlY = Infinity;
    let brX = -Infinity;
    let brY = -Infinity;
    for (const p of points) {
        tlX = Math.min(tlX, p.x);
        tlY = Math.min(tlY, p.y);
        brX = Math.max(brX, p.x);
        brY = Math.max(brY, p.y);
    }
    return [tlX, tlY, brX, brY];
}
export function easeCubicInOut(t) {
    if (t <= 0)
        return 0;
    if (t >= 1)
        return 1;
    const t2 = t * t, t3 = t2 * t;
    return 4 * (t < 0.5 ? t3 : 3 * (t - t2) + t3 - 0.75);
}
export function bezier(p1x, p1y, p2x, p2y) {
    const bezier = new UnitBezier(p1x, p1y, p2x, p2y);
    return (t) => {
        return bezier.solve(t);
    };
}
export const defaultEasing = bezier(0.25, 0.1, 0.25, 1);
export function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
}
export function wrap(n, min, max) {
    const d = max - min;
    const w = ((n - min) % d + d) % d + min;
    return (w === min) ? max : w;
}
export function keysDifference(obj, other) {
    const difference = [];
    for (const i in obj) {
        if (!(i in other)) {
            difference.push(i);
        }
    }
    return difference;
}
export function extend(dest, ...sources) {
    for (const src of sources) {
        for (const k in src) {
            dest[k] = src[k];
        }
    }
    return dest;
}
export function pick(src, properties) {
    const result = {};
    for (let i = 0; i < properties.length; i++) {
        const k = properties[i];
        if (k in src) {
            result[k] = src[k];
        }
    }
    return result;
}
let id = 1;
export function uniqueId() {
    return id++;
}
export function isPowerOfTwo(value) {
    return (Math.log(value) / Math.LN2) % 1 === 0;
}
export function nextPowerOfTwo(value) {
    if (value <= 1)
        return 1;
    return Math.pow(2, Math.ceil(Math.log(value) / Math.LN2));
}
export function zoomScale(zoom) { return Math.pow(2, zoom); }
export function scaleZoom(scale) { return Math.log(scale) / Math.LN2; }
export function mapObject(input, iterator, context) {
    const output = {};
    for (const key in input) {
        output[key] = iterator.call(context || this, input[key], key, input);
    }
    return output;
}
export function filterObject(input, iterator, context) {
    const output = {};
    for (const key in input) {
        if (iterator.call(context || this, input[key], key, input)) {
            output[key] = input[key];
        }
    }
    return output;
}
export function deepEqual(a, b) {
    if (Array.isArray(a)) {
        if (!Array.isArray(b) || a.length !== b.length)
            return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i]))
                return false;
        }
        return true;
    }
    if (typeof a === 'object' && a !== null && b !== null) {
        if (!(typeof b === 'object'))
            return false;
        const keys = Object.keys(a);
        if (keys.length !== Object.keys(b).length)
            return false;
        for (const key in a) {
            if (!deepEqual(a[key], b[key]))
                return false;
        }
        return true;
    }
    return a === b;
}
export function clone(input) {
    if (Array.isArray(input)) {
        return input.map(clone);
    }
    else if (typeof input === 'object' && input) {
        return mapObject(input, clone);
    }
    else {
        return input;
    }
}
export function arraysIntersect(a, b) {
    for (let l = 0; l < a.length; l++) {
        if (b.indexOf(a[l]) >= 0)
            return true;
    }
    return false;
}
const warnOnceHistory = {};
export function warnOnce(message) {
    if (!warnOnceHistory[message]) {
        if (typeof console !== 'undefined')
            console.warn(message);
        warnOnceHistory[message] = true;
    }
}
export function isCounterClockwise(a, b, c) {
    return (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
}
export function findLineIntersection(a1, a2, b1, b2) {
    const aDeltaY = a2.y - a1.y;
    const aDeltaX = a2.x - a1.x;
    const bDeltaY = b2.y - b1.y;
    const bDeltaX = b2.x - b1.x;
    const denominator = (bDeltaY * aDeltaX) - (bDeltaX * aDeltaY);
    if (denominator === 0) {
        return null;
    }
    const originDeltaY = a1.y - b1.y;
    const originDeltaX = a1.x - b1.x;
    const aInterpolation = (bDeltaX * originDeltaY - bDeltaY * originDeltaX) / denominator;
    return new Point(a1.x + (aInterpolation * aDeltaX), a1.y + (aInterpolation * aDeltaY));
}
export function sphericalToCartesian([r, azimuthal, polar]) {
    azimuthal += 90;
    azimuthal *= Math.PI / 180;
    polar *= Math.PI / 180;
    return {
        x: r * Math.cos(azimuthal) * Math.sin(polar),
        y: r * Math.sin(azimuthal) * Math.sin(polar),
        z: r * Math.cos(polar)
    };
}
export function isWorker(self) {
    return typeof WorkerGlobalScope !== 'undefined' && typeof self !== 'undefined' && self instanceof WorkerGlobalScope;
}
export function parseCacheControl(cacheControl) {
    const re = /(?:^|(?:\s*\,\s*))([^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)(?:\=(?:([^\x00-\x20\(\)<>@\,;\:\\"\/\[\]\?\=\{\}\x7F]+)|(?:\"((?:[^"\\]|\\.)*)\")))?/g;
    const header = {};
    cacheControl.replace(re, ($0, $1, $2, $3) => {
        const value = $2 || $3;
        header[$1] = value ? value.toLowerCase() : true;
        return '';
    });
    if (header['max-age']) {
        const maxAge = parseInt(header['max-age'], 10);
        if (isNaN(maxAge))
            delete header['max-age'];
        else
            header['max-age'] = maxAge;
    }
    return header;
}
let _isSafari = null;
export function isSafari(scope) {
    if (_isSafari == null) {
        const userAgent = scope.navigator ? scope.navigator.userAgent : null;
        _isSafari = !!scope.safari ||
            !!(userAgent && (/\b(iPad|iPhone|iPod)\b/.test(userAgent) || (!!userAgent.match('Safari') && !userAgent.match('Chrome'))));
    }
    return _isSafari;
}
export function storageAvailable(type) {
    try {
        const storage = window[type];
        storage.setItem('_mapbox_test_', 1);
        storage.removeItem('_mapbox_test_');
        return true;
    }
    catch (_a) {
        return false;
    }
}
export function b64EncodeUnicode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (match, p1) => {
        return String.fromCharCode(Number('0x' + p1));
    }));
}
export function b64DecodeUnicode(str) {
    return decodeURIComponent(atob(str).split('').map((c) => {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}
export function isImageBitmap(image) {
    return typeof ImageBitmap !== 'undefined' && image instanceof ImageBitmap;
}
export const arrayBufferToImageBitmap = (data) => __awaiter(void 0, void 0, void 0, function* () {
    if (data.byteLength === 0) {
        return createImageBitmap(new ImageData(1, 1));
    }
    const blob = new Blob([new Uint8Array(data)], { type: 'image/png' });
    try {
        return createImageBitmap(blob);
    }
    catch (e) {
        throw new Error(`Could not load image because of ${e.message}. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.`);
    }
});
const transparentPngUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQYV2NgAAIAAAUAAarVyFEAAAAASUVORK5CYII=';
export const arrayBufferToImage = (data) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve(img);
            URL.revokeObjectURL(img.src);
            img.onload = null;
            window.requestAnimationFrame(() => { img.src = transparentPngUrl; });
        };
        img.onerror = () => reject(new Error('Could not load image. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.'));
        const blob = new Blob([new Uint8Array(data)], { type: 'image/png' });
        img.src = data.byteLength ? URL.createObjectURL(blob) : transparentPngUrl;
    });
};
function computeVideoFrameParameters(image, x, y, width, height) {
    const destRowOffset = Math.max(-x, 0) * 4;
    const firstSourceRow = Math.max(0, y);
    const firstDestRow = firstSourceRow - y;
    const offset = firstDestRow * width * 4 + destRowOffset;
    const stride = width * 4;
    const sourceLeft = Math.max(0, x);
    const sourceTop = Math.max(0, y);
    const sourceRight = Math.min(image.width, x + width);
    const sourceBottom = Math.min(image.height, y + height);
    return {
        rect: {
            x: sourceLeft,
            y: sourceTop,
            width: sourceRight - sourceLeft,
            height: sourceBottom - sourceTop
        },
        layout: [{ offset, stride }]
    };
}
export function readImageUsingVideoFrame(image, x, y, width, height) {
    return __awaiter(this, void 0, void 0, function* () {
        if (typeof VideoFrame === 'undefined') {
            throw new Error('VideoFrame not supported');
        }
        const frame = new VideoFrame(image, { timestamp: 0 });
        try {
            const format = frame === null || frame === void 0 ? void 0 : frame.format;
            if (!format || !(format.startsWith('BGR') || format.startsWith('RGB'))) {
                throw new Error(`Unrecognized format ${format}`);
            }
            const swapBR = format.startsWith('BGR');
            const result = new Uint8ClampedArray(width * height * 4);
            yield frame.copyTo(result, computeVideoFrameParameters(image, x, y, width, height));
            if (swapBR) {
                for (let i = 0; i < result.length; i += 4) {
                    const tmp = result[i];
                    result[i] = result[i + 2];
                    result[i + 2] = tmp;
                }
            }
            return result;
        }
        finally {
            frame.close();
        }
    });
}
let offscreenCanvas;
let offscreenCanvasContext;
export function readImageDataUsingOffscreenCanvas(imgBitmap, x, y, width, height) {
    const origWidth = imgBitmap.width;
    const origHeight = imgBitmap.height;
    if (!offscreenCanvas || !offscreenCanvasContext) {
        offscreenCanvas = new OffscreenCanvas(origWidth, origHeight);
        offscreenCanvasContext = offscreenCanvas.getContext('2d', { willReadFrequently: true });
    }
    offscreenCanvas.width = origWidth;
    offscreenCanvas.height = origHeight;
    offscreenCanvasContext.drawImage(imgBitmap, 0, 0, origWidth, origHeight);
    const imgData = offscreenCanvasContext.getImageData(x, y, width, height);
    offscreenCanvasContext.clearRect(0, 0, origWidth, origHeight);
    return imgData.data;
}
export function getImageData(image, x, y, width, height) {
    return __awaiter(this, void 0, void 0, function* () {
        if (isOffscreenCanvasDistorted()) {
            try {
                return yield readImageUsingVideoFrame(image, x, y, width, height);
            }
            catch (_a) {
            }
        }
        return readImageDataUsingOffscreenCanvas(image, x, y, width, height);
    });
}
export function subscribe(target, message, listener, options) {
    target.addEventListener(message, listener, options);
    return {
        unsubscribe: () => {
            target.removeEventListener(message, listener, options);
        }
    };
}
export function degreesToRadians(degrees) {
    return degrees * Math.PI / 180;
}
export function radiansToDegrees(degrees) {
    return degrees / Math.PI * 180;
}
export function rollPitchBearingEqual(a, b) {
    return a.roll == b.roll && a.pitch == b.pitch && a.bearing == b.bearing;
}
export function getRollPitchBearing(rotation) {
    const m = new Float64Array(9);
    mat3.fromQuat(m, rotation);
    const xAngle = radiansToDegrees(-Math.asin(clamp(m[2], -1, 1)));
    let roll;
    let bearing;
    if (Math.hypot(m[5], m[8]) < 1.0e-3) {
        roll = 0.0;
        bearing = -radiansToDegrees(Math.atan2(m[3], m[4]));
    }
    else {
        roll = radiansToDegrees((m[5] === 0.0 && m[8] === 0.0) ? 0.0 : Math.atan2(m[5], m[8]));
        bearing = radiansToDegrees((m[1] === 0.0 && m[0] === 0.0) ? 0.0 : Math.atan2(m[1], m[0]));
    }
    return { roll, pitch: xAngle + 90.0, bearing };
}
export function getAngleDelta(lastPoint, currentPoint, center) {
    const pointVect = vec2.fromValues(currentPoint.x - center.x, currentPoint.y - center.y);
    const lastPointVec = vec2.fromValues(lastPoint.x - center.x, lastPoint.y - center.y);
    const crossProduct = pointVect[0] * lastPointVec[1] - pointVect[1] * lastPointVec[0];
    const angleRadians = Math.atan2(crossProduct, vec2.dot(pointVect, lastPointVec));
    return radiansToDegrees(angleRadians);
}
export function rollPitchBearingToQuat(roll, pitch, bearing) {
    const rotation = new Float64Array(4);
    quat.fromEuler(rotation, roll, pitch - 90.0, bearing);
    return rotation;
}
export const MAX_TILE_ZOOM = 25;
export const MIN_TILE_ZOOM = 0;
export const MAX_VALID_LATITUDE = 85.051129;
const touchableEvents = {
    touchstart: true,
    touchmove: true,
    touchmoveWindow: true,
    touchend: true,
    touchcancel: true
};
const pointableEvents = {
    dblclick: true,
    click: true,
    mouseover: true,
    mouseout: true,
    mousedown: true,
    mousemove: true,
    mousemoveWindow: true,
    mouseup: true,
    mouseupWindow: true,
    contextmenu: true,
    wheel: true
};
export function isTouchableEvent(event, eventType) {
    return touchableEvents[eventType] && 'touches' in event;
}
export function isPointableEvent(event, eventType) {
    return pointableEvents[eventType] && (event instanceof MouseEvent || event instanceof WheelEvent);
}
export function isTouchableOrPointableType(eventType) {
    return touchableEvents[eventType] || pointableEvents[eventType];
}
//# sourceMappingURL=util.js.map