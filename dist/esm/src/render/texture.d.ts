import type { Context } from '../gl/context';
import type { RGBAImage, AlphaImage } from '../util/image';
export type TextureFormat = WebGLRenderingContextBase['RGBA'] | WebGLRenderingContextBase['ALPHA'];
export type TextureFilter = WebGLRenderingContextBase['LINEAR'] | WebGLRenderingContextBase['LINEAR_MIPMAP_NEAREST'] | WebGLRenderingContextBase['NEAREST'];
export type TextureWrap = WebGLRenderingContextBase['REPEAT'] | WebGLRenderingContextBase['CLAMP_TO_EDGE'] | WebGLRenderingContextBase['MIRRORED_REPEAT'];
type EmptyImage = {
    width: number;
    height: number;
    data: null;
};
type DataTextureImage = RGBAImage | AlphaImage | EmptyImage;
export type TextureImage = TexImageSource | DataTextureImage;
export declare class Texture {
    context: Context;
    size: [number, number];
    texture: WebGLTexture;
    format: TextureFormat;
    filter: TextureFilter;
    wrap: TextureWrap;
    useMipmap: boolean;
    constructor(context: Context, image: TextureImage, format: TextureFormat, options?: {
        premultiply?: boolean;
        useMipmap?: boolean;
    } | null);
    update(image: TextureImage, options?: {
        premultiply?: boolean;
        useMipmap?: boolean;
    } | null, position?: {
        x: number;
        y: number;
    }): void;
    bind(filter: TextureFilter, wrap: TextureWrap, minFilter?: TextureFilter | null): void;
    isSizePowerOfTwo(): boolean;
    destroy(): void;
}
export {};
//# sourceMappingURL=texture.d.ts.map