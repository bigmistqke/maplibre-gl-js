import { LngLat, earthRadius } from '../geo/lng_lat';
const earthCircumference = 2 * Math.PI * earthRadius;
function circumferenceAtLatitude(latitude) {
    return earthCircumference * Math.cos(latitude * Math.PI / 180);
}
export function mercatorXfromLng(lng) {
    return (180 + lng) / 360;
}
export function mercatorYfromLat(lat) {
    return (180 - (180 / Math.PI * Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360)))) / 360;
}
export function mercatorZfromAltitude(altitude, lat) {
    return altitude / circumferenceAtLatitude(lat);
}
export function lngFromMercatorX(x) {
    return x * 360 - 180;
}
export function latFromMercatorY(y) {
    const y2 = 180 - y * 360;
    return 360 / Math.PI * Math.atan(Math.exp(y2 * Math.PI / 180)) - 90;
}
export function altitudeFromMercatorZ(z, y) {
    return z * circumferenceAtLatitude(latFromMercatorY(y));
}
export function mercatorScale(lat) {
    return 1 / Math.cos(lat * Math.PI / 180);
}
export class MercatorCoordinate {
    constructor(x, y, z = 0) {
        this.x = +x;
        this.y = +y;
        this.z = +z;
    }
    static fromLngLat(lngLatLike, altitude = 0) {
        const lngLat = LngLat.convert(lngLatLike);
        return new MercatorCoordinate(mercatorXfromLng(lngLat.lng), mercatorYfromLat(lngLat.lat), mercatorZfromAltitude(altitude, lngLat.lat));
    }
    toLngLat() {
        return new LngLat(lngFromMercatorX(this.x), latFromMercatorY(this.y));
    }
    toAltitude() {
        return altitudeFromMercatorZ(this.z, this.y);
    }
    meterInMercatorCoordinateUnits() {
        return 1 / earthCircumference * mercatorScale(latFromMercatorY(this.y));
    }
}
//# sourceMappingURL=mercator_coordinate.js.map