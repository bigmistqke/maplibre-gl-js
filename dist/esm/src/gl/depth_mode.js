const ALWAYS = 0x0207;
export class DepthMode {
    constructor(depthFunc, depthMask, depthRange) {
        this.func = depthFunc;
        this.mask = depthMask;
        this.range = depthRange;
    }
}
DepthMode.ReadOnly = false;
DepthMode.ReadWrite = true;
DepthMode.disabled = new DepthMode(ALWAYS, DepthMode.ReadOnly, [0, 1]);
//# sourceMappingURL=depth_mode.js.map