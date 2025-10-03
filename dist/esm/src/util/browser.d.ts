export declare const browser: {
    now: any;
    frame(abortController: AbortController, fn: (paintStartTimestamp: number) => void, reject: (error: Error) => void): void;
    frameAsync(abortController: AbortController): Promise<number>;
    getImageData(img: HTMLImageElement | ImageBitmap, padding?: number): ImageData;
    getImageCanvasContext(img: HTMLImageElement | ImageBitmap): CanvasRenderingContext2D;
    resolveURL(path: string): any;
    hardwareConcurrency: number;
    readonly prefersReducedMotion: boolean;
};
//# sourceMappingURL=browser.d.ts.map