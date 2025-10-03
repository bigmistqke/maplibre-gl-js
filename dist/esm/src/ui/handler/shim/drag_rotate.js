export class DragRotateHandler {
    constructor(options, mouseRotate, mousePitch, mouseRoll) {
        this._pitchWithRotate = options.pitchWithRotate;
        this._rollEnabled = options.rollEnabled;
        this._mouseRotate = mouseRotate;
        this._mousePitch = mousePitch;
        this._mouseRoll = mouseRoll;
    }
    enable() {
        var _a, _b, _c;
        (_a = this._mouseRotate) === null || _a === void 0 ? void 0 : _a.enable();
        if (this._pitchWithRotate)
            (_b = this._mousePitch) === null || _b === void 0 ? void 0 : _b.enable();
        if (this._rollEnabled)
            (_c = this._mouseRoll) === null || _c === void 0 ? void 0 : _c.enable();
    }
    disable() {
        var _a, _b, _c;
        (_a = this._mouseRotate) === null || _a === void 0 ? void 0 : _a.disable();
        (_b = this._mousePitch) === null || _b === void 0 ? void 0 : _b.disable();
        (_c = this._mouseRoll) === null || _c === void 0 ? void 0 : _c.disable();
    }
    isEnabled() {
        var _a, _b, _c;
        return !!(((_a = this._mouseRotate) === null || _a === void 0 ? void 0 : _a.isEnabled()) && (!this._pitchWithRotate || ((_b = this._mousePitch) === null || _b === void 0 ? void 0 : _b.isEnabled())) && (!this._rollEnabled || ((_c = this._mouseRoll) === null || _c === void 0 ? void 0 : _c.isEnabled())));
    }
    isActive() {
        var _a, _b, _c;
        return !!(((_a = this._mouseRotate) === null || _a === void 0 ? void 0 : _a.isActive()) || ((_b = this._mousePitch) === null || _b === void 0 ? void 0 : _b.isActive()) || ((_c = this._mouseRoll) === null || _c === void 0 ? void 0 : _c.isActive()));
    }
}
//# sourceMappingURL=drag_rotate.js.map