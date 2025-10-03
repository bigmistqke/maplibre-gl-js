import { LngLat } from '../geo/lng_lat';
import type { LngLatLike } from '../geo/lng_lat';
import { type IMercatorCoordinate } from '@maplibre/maplibre-gl-style-spec';
export declare function mercatorXfromLng(lng: number): number;
export declare function mercatorYfromLat(lat: number): number;
export declare function mercatorZfromAltitude(altitude: number, lat: number): number;
export declare function lngFromMercatorX(x: number): number;
export declare function latFromMercatorY(y: number): number;
export declare function altitudeFromMercatorZ(z: number, y: number): number;
export declare function mercatorScale(lat: number): number;
export declare class MercatorCoordinate implements IMercatorCoordinate {
    x: number;
    y: number;
    z: number;
    constructor(x: number, y: number, z?: number);
    static fromLngLat(lngLatLike: LngLatLike, altitude?: number): MercatorCoordinate;
    toLngLat(): LngLat;
    toAltitude(): number;
    meterInMercatorCoordinateUnits(): number;
}
//# sourceMappingURL=mercator_coordinate.d.ts.map