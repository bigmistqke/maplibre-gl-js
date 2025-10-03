export declare const earthRadius = 6371008.8;
export type LngLatLike = LngLat | {
    lng: number;
    lat: number;
} | {
    lon: number;
    lat: number;
} | [number, number];
export declare class LngLat {
    lng: number;
    lat: number;
    constructor(lng: number, lat: number);
    wrap(): LngLat;
    toArray(): [number, number];
    toString(): string;
    distanceTo(lngLat: LngLat): number;
    static convert(input: LngLatLike): LngLat;
}
//# sourceMappingURL=lng_lat.d.ts.map