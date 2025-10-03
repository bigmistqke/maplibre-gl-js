import { ColorAttachment, DepthAttachment } from './value';
import type { Context } from './context';
export declare class Framebuffer {
    context: Context;
    width: number;
    height: number;
    framebuffer: WebGLFramebuffer;
    colorAttachment: ColorAttachment;
    depthAttachment: DepthAttachment;
    constructor(context: Context, width: number, height: number, hasDepth: boolean, hasStencil: boolean);
    destroy(): void;
}
//# sourceMappingURL=framebuffer.d.ts.map