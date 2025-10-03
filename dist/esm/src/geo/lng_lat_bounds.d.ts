import { LngLat } from './lng_lat';
import type { LngLatLike } from './lng_lat';
export type LngLatBoundsLike = LngLatBounds | [LngLatLike, LngLatLike] | [number, number, number, number];
export declare class LngLatBounds {
    _ne: LngLat;
    _sw: LngLat;
    constructor(sw?: LngLatLike | [number, number, number, number] | [LngLatLike, LngLatLike], ne?: LngLatLike);
    setNorthEast(ne: LngLatLike): this;
    setSouthWest(sw: LngLatLike): this;
    extend(obj: LngLatLike | LngLatBoundsLike): this;
    getCenter(): LngLat;
    getSouthWest(): LngLat;
    getNorthEast(): LngLat;
    getNorthWest(): LngLat;
    getSouthEast(): LngLat;
    getWest(): number;
    getSouth(): number;
    getEast(): number;
    getNorth(): number;
    toArray(): [number, number][];
    toString(): string;
    isEmpty(): boolean;
    contains(lnglat: LngLatLike): boolean;
    static convert(input: LngLatBoundsLike | null): LngLatBounds;
    static fromLngLat(center: LngLat, radius?: number): LngLatBounds;
    adjustAntiMeridian(): LngLatBounds;
}
//# sourceMappingURL=lng_lat_bounds.d.ts.map