import Point from '@mapbox/point-geometry';
import { polygonIntersectsBufferedPoint } from '../util/intersection_tests';
export function getMaximumPaintValue(property, layer, bucket) {
    const value = layer.paint.get(property).value;
    if (value.kind === 'constant') {
        return value.value;
    }
    else {
        return bucket.programConfigurations.get(layer.id).getMaxValue(property);
    }
}
export function translateDistance(translate) {
    return Math.sqrt(translate[0] * translate[0] + translate[1] * translate[1]);
}
export function translate(queryGeometry, translate, translateAnchor, bearing, pixelsToTileUnits) {
    if (!translate[0] && !translate[1]) {
        return queryGeometry;
    }
    const pt = Point.convert(translate)._mult(pixelsToTileUnits);
    if (translateAnchor === 'viewport') {
        pt._rotate(-bearing);
    }
    const translated = [];
    for (let i = 0; i < queryGeometry.length; i++) {
        const point = queryGeometry[i];
        translated.push(point.sub(pt));
    }
    return translated;
}
export function offsetLine(rings, offset) {
    const newRings = [];
    for (let ringIndex = 0; ringIndex < rings.length; ringIndex++) {
        const ring = rings[ringIndex];
        const newRing = [];
        for (let index = 0; index < ring.length; index++) {
            const a = ring[index - 1];
            const b = ring[index];
            const c = ring[index + 1];
            const aToB = index === 0 ? new Point(0, 0) : b.sub(a)._unit()._perp();
            const bToC = index === ring.length - 1 ? new Point(0, 0) : c.sub(b)._unit()._perp();
            const extrude = aToB._add(bToC)._unit();
            const cosHalfAngle = extrude.x * bToC.x + extrude.y * bToC.y;
            if (cosHalfAngle !== 0) {
                extrude._mult(1 / cosHalfAngle);
            }
            newRing.push(extrude._mult(offset)._add(b));
        }
        newRings.push(newRing);
    }
    return newRings;
}
function intersectionTestMapMap({ queryGeometry, size }, point) {
    return polygonIntersectsBufferedPoint(queryGeometry, point, size);
}
function intersectionTestMapViewport({ queryGeometry, size, transform, unwrappedTileID, getElevation }, point) {
    const w = transform.projectTileCoordinates(point.x, point.y, unwrappedTileID, getElevation).signedDistanceFromCamera;
    const adjustedSize = size * (w / transform.cameraToCenterDistance);
    return polygonIntersectsBufferedPoint(queryGeometry, point, adjustedSize);
}
function intersectionTestViewportMap({ queryGeometry, size, transform, unwrappedTileID, getElevation }, point) {
    const w = transform.projectTileCoordinates(point.x, point.y, unwrappedTileID, getElevation).signedDistanceFromCamera;
    const adjustedSize = size * (transform.cameraToCenterDistance / w);
    return polygonIntersectsBufferedPoint(queryGeometry, projectPoint(point, transform, unwrappedTileID, getElevation), adjustedSize);
}
function intersectionTestViewportViewport({ queryGeometry, size, transform, unwrappedTileID, getElevation }, point) {
    return polygonIntersectsBufferedPoint(queryGeometry, projectPoint(point, transform, unwrappedTileID, getElevation), size);
}
export function circleIntersection({ queryGeometry, size, transform, unwrappedTileID, getElevation, pitchAlignment = 'map', pitchScale = 'map' }, geometry) {
    const intersectionTest = pitchAlignment === 'map'
        ? (pitchScale === 'map' ? intersectionTestMapMap : intersectionTestMapViewport)
        : (pitchScale === 'map' ? intersectionTestViewportMap : intersectionTestViewportViewport);
    const param = { queryGeometry, size, transform, unwrappedTileID, getElevation };
    for (const ring of geometry) {
        for (const point of ring) {
            if (intersectionTest(param, point)) {
                return true;
            }
        }
    }
    return false;
}
function projectPoint(tilePoint, transform, unwrappedTileID, getElevation) {
    const clipPoint = transform.projectTileCoordinates(tilePoint.x, tilePoint.y, unwrappedTileID, getElevation).point;
    const pixelPoint = new Point((clipPoint.x * 0.5 + 0.5) * transform.width, (-clipPoint.y * 0.5 + 0.5) * transform.height);
    return pixelPoint;
}
export function projectQueryGeometry(queryGeometry, transform, unwrappedTileID, getElevation) {
    return queryGeometry.map((p) => {
        return projectPoint(p, transform, unwrappedTileID, getElevation);
    });
}
//# sourceMappingURL=query_utils.js.map