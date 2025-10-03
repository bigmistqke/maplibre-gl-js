import { type ProjectionGPUContext } from './projection';
export declare class ProjectionErrorMeasurement {
    private readonly _readbackWaitFrames;
    private readonly _measureWaitFrames;
    private readonly _texWidth;
    private readonly _texHeight;
    private readonly _texFormat;
    private readonly _texType;
    private _fullscreenTriangle;
    private _fbo;
    private _resultBuffer;
    private _pbo;
    private _cachedRenderContext;
    private _measuredError;
    private _updateCount;
    private _lastReadbackFrame;
    get awaitingQuery(): boolean;
    private _readbackQueue;
    constructor(renderContext: ProjectionGPUContext);
    destroy(): void;
    updateErrorLoop(normalizedMercatorY: number, expectedAngleY: number): number;
    private _bindFramebuffer;
    private _renderErrorTexture;
    private _tryReadback;
    private static _parseRGBA8float;
}
//# sourceMappingURL=globe_projection_error_measurement.d.ts.map