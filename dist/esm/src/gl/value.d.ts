import { Color } from '@maplibre/maplibre-gl-style-spec';
import type { Context } from './context';
import type { BlendFuncType, BlendEquationType, ColorMaskType, DepthRangeType, DepthMaskType, StencilFuncType, StencilOpType, DepthFuncType, TextureUnitType, ViewportType, CullFaceModeType, FrontFaceType } from './types';
export interface IValue<T> {
    current: T;
    default: T;
    dirty: boolean;
    get(): T;
    setDefault(): void;
    set(value: T): void;
}
declare class BaseValue<T> implements IValue<T> {
    gl: WebGLRenderingContext | WebGL2RenderingContext;
    current: T;
    default: T;
    dirty: boolean;
    constructor(context: Context);
    get(): T;
    set(value: T): void;
    getDefault(): T;
    setDefault(): void;
}
export declare class ClearColor extends BaseValue<Color> {
    getDefault(): Color;
    set(v: Color): void;
}
export declare class ClearDepth extends BaseValue<number> {
    getDefault(): number;
    set(v: number): void;
}
export declare class ClearStencil extends BaseValue<number> {
    getDefault(): number;
    set(v: number): void;
}
export declare class ColorMask extends BaseValue<ColorMaskType> {
    getDefault(): ColorMaskType;
    set(v: ColorMaskType): void;
}
export declare class DepthMask extends BaseValue<DepthMaskType> {
    getDefault(): DepthMaskType;
    set(v: DepthMaskType): void;
}
export declare class StencilMask extends BaseValue<number> {
    getDefault(): number;
    set(v: number): void;
}
export declare class StencilFunc extends BaseValue<StencilFuncType> {
    getDefault(): StencilFuncType;
    set(v: StencilFuncType): void;
}
export declare class StencilOp extends BaseValue<StencilOpType> {
    getDefault(): StencilOpType;
    set(v: StencilOpType): void;
}
export declare class StencilTest extends BaseValue<boolean> {
    getDefault(): boolean;
    set(v: boolean): void;
}
export declare class DepthRange extends BaseValue<DepthRangeType> {
    getDefault(): DepthRangeType;
    set(v: DepthRangeType): void;
}
export declare class DepthTest extends BaseValue<boolean> {
    getDefault(): boolean;
    set(v: boolean): void;
}
export declare class DepthFunc extends BaseValue<DepthFuncType> {
    getDefault(): DepthFuncType;
    set(v: DepthFuncType): void;
}
export declare class Blend extends BaseValue<boolean> {
    getDefault(): boolean;
    set(v: boolean): void;
}
export declare class BlendFunc extends BaseValue<BlendFuncType> {
    getDefault(): BlendFuncType;
    set(v: BlendFuncType): void;
}
export declare class BlendColor extends BaseValue<Color> {
    getDefault(): Color;
    set(v: Color): void;
}
export declare class BlendEquation extends BaseValue<BlendEquationType> {
    getDefault(): BlendEquationType;
    set(v: BlendEquationType): void;
}
export declare class CullFace extends BaseValue<boolean> {
    getDefault(): boolean;
    set(v: boolean): void;
}
export declare class CullFaceSide extends BaseValue<CullFaceModeType> {
    getDefault(): CullFaceModeType;
    set(v: CullFaceModeType): void;
}
export declare class FrontFace extends BaseValue<FrontFaceType> {
    getDefault(): FrontFaceType;
    set(v: FrontFaceType): void;
}
export declare class ProgramValue extends BaseValue<WebGLProgram> {
    getDefault(): WebGLProgram;
    set(v?: WebGLProgram | null): void;
}
export declare class ActiveTextureUnit extends BaseValue<TextureUnitType> {
    getDefault(): TextureUnitType;
    set(v: TextureUnitType): void;
}
export declare class Viewport extends BaseValue<ViewportType> {
    getDefault(): ViewportType;
    set(v: ViewportType): void;
}
export declare class BindFramebuffer extends BaseValue<WebGLFramebuffer> {
    getDefault(): WebGLFramebuffer;
    set(v?: WebGLFramebuffer | null): void;
}
export declare class BindRenderbuffer extends BaseValue<WebGLRenderbuffer> {
    getDefault(): WebGLRenderbuffer;
    set(v?: WebGLRenderbuffer | null): void;
}
export declare class BindTexture extends BaseValue<WebGLTexture> {
    getDefault(): WebGLTexture;
    set(v?: WebGLTexture | null): void;
}
export declare class BindVertexBuffer extends BaseValue<WebGLBuffer> {
    getDefault(): WebGLBuffer;
    set(v?: WebGLBuffer | null): void;
}
export declare class BindElementBuffer extends BaseValue<WebGLBuffer> {
    getDefault(): WebGLBuffer;
    set(v?: WebGLBuffer | null): void;
}
export declare class BindVertexArray extends BaseValue<WebGLVertexArrayObject | null> {
    getDefault(): WebGLVertexArrayObject | null;
    set(v: WebGLVertexArrayObject | null): void;
}
export declare class PixelStoreUnpack extends BaseValue<number> {
    getDefault(): number;
    set(v: number): void;
}
export declare class PixelStoreUnpackPremultiplyAlpha extends BaseValue<boolean> {
    getDefault(): boolean;
    set(v: boolean): void;
}
export declare class PixelStoreUnpackFlipY extends BaseValue<boolean> {
    getDefault(): boolean;
    set(v: boolean): void;
}
declare class FramebufferAttachment<T> extends BaseValue<T> {
    parent: WebGLFramebuffer;
    context: Context;
    constructor(context: Context, parent: WebGLFramebuffer);
    getDefault(): any;
}
export declare class ColorAttachment extends FramebufferAttachment<WebGLTexture> {
    setDirty(): void;
    set(v?: WebGLTexture | null): void;
}
export declare class DepthAttachment extends FramebufferAttachment<WebGLRenderbuffer> {
    set(v?: WebGLRenderbuffer | null): void;
}
export declare class DepthStencilAttachment extends FramebufferAttachment<WebGLRenderbuffer> {
    set(v?: WebGLRenderbuffer | null): void;
}
export {};
//# sourceMappingURL=value.d.ts.map