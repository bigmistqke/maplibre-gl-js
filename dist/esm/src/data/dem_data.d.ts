import { RGBAImage } from '../util/image';
export type DEMEncoding = 'mapbox' | 'terrarium' | 'custom';
export declare class DEMData {
    uid: string | number;
    data: Uint32Array;
    stride: number;
    dim: number;
    min: number;
    max: number;
    redFactor: number;
    greenFactor: number;
    blueFactor: number;
    baseShift: number;
    constructor(uid: string | number, data: RGBAImage | ImageData, encoding: DEMEncoding, redFactor?: number, greenFactor?: number, blueFactor?: number, baseShift?: number);
    get(x: number, y: number): number;
    getUnpackVector(): number[];
    _idx(x: number, y: number): number;
    unpack(r: number, g: number, b: number): number;
    pack(v: number): {
        r: number;
        g: number;
        b: number;
    };
    getPixels(): RGBAImage;
    backfillBorder(borderTile: DEMData, dx: number, dy: number): void;
}
export declare function packDEMData(v: number, unpackVector: number[]): {
    r: number;
    g: number;
    b: number;
};
//# sourceMappingURL=dem_data.d.ts.map