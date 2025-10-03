import Point from '@mapbox/point-geometry';
import { MercatorCoordinate } from '../geo/mercator_coordinate';
import { type mat4 } from 'gl-matrix';
import { type ICanonicalTileID, type IMercatorCoordinate } from '@maplibre/maplibre-gl-style-spec';
export declare class CanonicalTileID implements ICanonicalTileID {
    z: number;
    x: number;
    y: number;
    key: string;
    constructor(z: number, x: number, y: number);
    equals(id: ICanonicalTileID): boolean;
    url(urls: Array<string>, pixelRatio: number, scheme?: string | null): string;
    isChildOf(parent: ICanonicalTileID): boolean;
    getTilePoint(coord: IMercatorCoordinate): Point;
    toString(): string;
}
export declare class UnwrappedTileID {
    wrap: number;
    canonical: CanonicalTileID;
    key: string;
    constructor(wrap: number, canonical: CanonicalTileID);
}
export declare class OverscaledTileID {
    overscaledZ: number;
    wrap: number;
    canonical: CanonicalTileID;
    key: string;
    terrainRttPosMatrix32f: mat4 | null;
    constructor(overscaledZ: number, wrap: number, z: number, x: number, y: number);
    clone(): OverscaledTileID;
    equals(id: OverscaledTileID): boolean;
    scaledTo(targetZ: number): OverscaledTileID;
    calculateScaledKey(targetZ: number, withWrap: boolean): string;
    isChildOf(parent: OverscaledTileID): boolean;
    children(sourceMaxZoom: number): OverscaledTileID[];
    isLessThan(rhs: OverscaledTileID): boolean;
    wrapped(): OverscaledTileID;
    unwrapTo(wrap: number): OverscaledTileID;
    overscaleFactor(): number;
    toUnwrapped(): UnwrappedTileID;
    toString(): string;
    getTilePoint(coord: MercatorCoordinate): Point;
}
export declare function calculateTileKey(wrap: number, overscaledZ: number, z: number, x: number, y: number): string;
//# sourceMappingURL=tile_id.d.ts.map