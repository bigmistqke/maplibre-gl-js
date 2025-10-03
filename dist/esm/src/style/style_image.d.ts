import { type RGBAImage } from '../util/image';
import type { Map } from '../ui/map';
export type SpriteJSON = {
    [id: string]: StyleImageMetadata & {
        width: number;
        height: number;
        x: number;
        y: number;
    };
};
export type SpriteOnDemandStyleImage = {
    width: number;
    height: number;
    x: number;
    y: number;
    context: CanvasRenderingContext2D;
};
export type StyleImageData = {
    data: RGBAImage;
    version?: number;
    hasRenderCallback?: boolean;
    userImage?: StyleImageInterface;
    spriteData?: SpriteOnDemandStyleImage;
};
export declare const enum TextFit {
    stretchOrShrink = "stretchOrShrink",
    stretchOnly = "stretchOnly",
    proportional = "proportional"
}
export type StyleImageMetadata = {
    pixelRatio: number;
    sdf: boolean;
    stretchX?: Array<[number, number]>;
    stretchY?: Array<[number, number]>;
    content?: [number, number, number, number];
    textFitWidth?: TextFit;
    textFitHeight?: TextFit;
};
export type StyleImage = StyleImageData & StyleImageMetadata;
export interface StyleImageInterface {
    width: number;
    height: number;
    data: Uint8Array | Uint8ClampedArray;
    render?: () => boolean;
    onAdd?: (map: Map, id: string) => void;
    onRemove?: () => void;
}
export declare function renderStyleImage(image: StyleImage): boolean;
//# sourceMappingURL=style_image.d.ts.map