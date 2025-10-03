export class DragRotateHandler {
    constructor(options, mouseRotate, mousePitch, mouseRoll) {
        this._pitchWithRotate = options.pitchWithRotate;
        this._rollEnabled = options.rollEnabled;
        this._mouseRotate = mouseRotate;
        this._mousePitch = mousePitch;
        this._mouseRoll = mouseRoll;
    }
    enable() {
        this._mouseRotate.enable();
        if (this._pitchWithRotate)
            this._mousePitch.enable();
        if (this._rollEnabled)
            this._mouseRoll.enable();
    }
    disable() {
        this._mouseRotate.disable();
        this._mousePitch.disable();
        this._mouseRoll.disable();
    }
    isEnabled() {
        return this._mouseRotate.isEnabled() && (!this._pitchWithRotate || this._mousePitch.isEnabled()) && (!this._rollEnabled || this._mouseRoll.isEnabled());
    }
    isActive() {
        return this._mouseRotate.isActive() || this._mousePitch.isActive() || this._mouseRoll.isActive();
    }
}
//# sourceMappingURL=drag_rotate.js.map