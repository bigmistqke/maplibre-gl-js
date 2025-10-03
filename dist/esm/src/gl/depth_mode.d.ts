import type { DepthFuncType, DepthMaskType, DepthRangeType } from './types';
export declare class DepthMode {
    func: DepthFuncType;
    mask: DepthMaskType;
    range: DepthRangeType;
    static ReadOnly: boolean;
    static ReadWrite: boolean;
    constructor(depthFunc: DepthFuncType, depthMask: DepthMaskType, depthRange: DepthRangeType);
    static disabled: Readonly<DepthMode>;
}
//# sourceMappingURL=depth_mode.d.ts.map