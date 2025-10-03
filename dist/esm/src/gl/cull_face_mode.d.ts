import type { CullFaceModeType, FrontFaceType } from './types';
export declare class CullFaceMode {
    enable: boolean;
    mode: CullFaceModeType;
    frontFace: FrontFaceType;
    constructor(enable: boolean, mode: CullFaceModeType, frontFace: FrontFaceType);
    static disabled: Readonly<CullFaceMode>;
    static backCCW: Readonly<CullFaceMode>;
    static frontCCW: Readonly<CullFaceMode>;
}
//# sourceMappingURL=cull_face_mode.d.ts.map