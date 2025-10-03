import { LngLat } from '../geo/lng_lat';
export function smartWrap(lngLat, priorPos, transform, useNormalWrap = false) {
    if (useNormalWrap || !transform.getCoveringTilesDetailsProvider().allowWorldCopies()) {
        return lngLat === null || lngLat === void 0 ? void 0 : lngLat.wrap();
    }
    const originalLngLat = new LngLat(lngLat.lng, lngLat.lat);
    lngLat = new LngLat(lngLat.lng, lngLat.lat);
    if (priorPos) {
        const left = new LngLat(lngLat.lng - 360, lngLat.lat);
        const right = new LngLat(lngLat.lng + 360, lngLat.lat);
        const delta = transform.locationToScreenPoint(lngLat).distSqr(priorPos);
        if (transform.locationToScreenPoint(left).distSqr(priorPos) < delta) {
            lngLat = left;
        }
        else if (transform.locationToScreenPoint(right).distSqr(priorPos) < delta) {
            lngLat = right;
        }
    }
    while (Math.abs(lngLat.lng - transform.center.lng) > 180) {
        const pos = transform.locationToScreenPoint(lngLat);
        if (pos.x >= 0 && pos.y >= 0 && pos.x <= transform.width && pos.y <= transform.height) {
            break;
        }
        if (lngLat.lng > transform.center.lng) {
            lngLat.lng -= 360;
        }
        else {
            lngLat.lng += 360;
        }
    }
    if (lngLat.lng !== originalLngLat.lng && transform.isPointOnMapSurface(transform.locationToScreenPoint(lngLat))) {
        return lngLat;
    }
    return originalLngLat;
}
//# sourceMappingURL=smart_wrap.js.map