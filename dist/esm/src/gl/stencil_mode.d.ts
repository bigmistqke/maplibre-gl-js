import type { StencilOpConstant, StencilTestGL } from './types';
export declare class StencilMode {
    test: StencilTestGL;
    ref: number;
    mask: number;
    fail: StencilOpConstant;
    depthFail: StencilOpConstant;
    pass: StencilOpConstant;
    constructor(test: StencilTestGL, ref: number, mask: number, fail: StencilOpConstant, depthFail: StencilOpConstant, pass: StencilOpConstant);
    static disabled: Readonly<StencilMode>;
}
//# sourceMappingURL=stencil_mode.d.ts.map