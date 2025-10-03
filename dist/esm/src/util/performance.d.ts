import type { RequestParameters } from '../util/ajax';
export type PerformanceMetrics = {
    loadTime: number;
    fullLoadTime: number;
    fps: number;
    percentDroppedFrames: number;
    totalFrames: number;
};
export declare enum PerformanceMarkers {
    create = "create",
    load = "load",
    fullLoad = "fullLoad"
}
export declare const PerformanceUtils: {
    mark(marker: PerformanceMarkers): void;
    frame(timestamp: number): void;
    clearMetrics(): void;
    getPerformanceMetrics(): PerformanceMetrics;
};
export declare class RequestPerformance {
    _marks: {
        start: string;
        end: string;
        measure: string;
    };
    constructor(request: RequestParameters);
    finish(): PerformanceEntryList;
}
export default performance;
//# sourceMappingURL=performance.d.ts.map