export class FrameLoop {
    private _render: () => void;
    private _dirty = false;
    private _rafId: number | null = null;
    private _running = false;

    constructor(render: () => void) {
        this._render = render;
    }

    start(): void {
        this._running = true;
    }

    stop(): void {
        this._running = false;
        if (this._rafId !== null) {
            cancelAnimationFrame(this._rafId);
            this._rafId = null;
        }
        this._dirty = false;
    }

    markDirty(): void {
        if (this._dirty || !this._running) return;
        this._dirty = true;
        this._rafId = requestAnimationFrame(() => {
            this._rafId = null;
            if (!this._running) return;
            this._dirty = false;
            this._render();
        });
    }
}
