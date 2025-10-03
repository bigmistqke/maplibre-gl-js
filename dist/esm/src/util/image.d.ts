import { type Color } from '@maplibre/maplibre-gl-style-spec';
export type Size = {
    width: number;
    height: number;
};
type Point2D = {
    x: number;
    y: number;
};
export declare class AlphaImage {
    width: number;
    height: number;
    data: Uint8Array;
    constructor(size: Size, data?: Uint8Array | Uint8ClampedArray);
    resize(size: Size): void;
    clone(): AlphaImage;
    static copy(srcImg: AlphaImage, dstImg: AlphaImage, srcPt: Point2D, dstPt: Point2D, size: Size): void;
}
export declare class RGBAImage {
    width: number;
    height: number;
    data: Uint8Array;
    constructor(size: Size, data?: Uint8Array | Uint8ClampedArray);
    resize(size: Size): void;
    replace(data: Uint8Array | Uint8ClampedArray, copy?: boolean): void;
    clone(): RGBAImage;
    static copy(srcImg: RGBAImage | ImageData, dstImg: RGBAImage, srcPt: Point2D, dstPt: Point2D, size: Size): void;
    setPixel(row: number, col: number, value: Color): void;
}
export {};
//# sourceMappingURL=image.d.ts.map