const FRONT = 0x0404;
const BACK = 0x0405;
const CCW = 0x0901;
export class CullFaceMode {
    constructor(enable, mode, frontFace) {
        this.enable = enable;
        this.mode = mode;
        this.frontFace = frontFace;
    }
}
CullFaceMode.disabled = new CullFaceMode(false, BACK, CCW);
CullFaceMode.backCCW = new CullFaceMode(true, BACK, CCW);
CullFaceMode.frontCCW = new CullFaceMode(true, FRONT, CCW);
//# sourceMappingURL=cull_face_mode.js.map