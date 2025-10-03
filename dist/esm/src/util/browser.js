import { createAbortError } from './abort_error';
import { subscribe } from './util';
const now = typeof performance !== 'undefined' && performance && performance.now ?
    performance.now.bind(performance) :
    Date.now.bind(Date);
let linkEl;
let reducedMotionQuery;
export const browser = {
    now,
    frame(abortController, fn, reject) {
        const frameId = requestAnimationFrame((paintStartTimestamp) => {
            unsubscribe();
            fn(paintStartTimestamp);
        });
        const { unsubscribe } = subscribe(abortController.signal, 'abort', () => {
            unsubscribe();
            cancelAnimationFrame(frameId);
            reject(createAbortError());
        }, false);
    },
    frameAsync(abortController) {
        return new Promise((resolve, reject) => {
            this.frame(abortController, resolve, reject);
        });
    },
    getImageData(img, padding = 0) {
        const context = this.getImageCanvasContext(img);
        return context.getImageData(-padding, -padding, img.width + 2 * padding, img.height + 2 * padding);
    },
    getImageCanvasContext(img) {
        const canvas = window.document.createElement('canvas');
        const context = canvas.getContext('2d', { willReadFrequently: true });
        if (!context) {
            throw new Error('failed to create canvas 2d context');
        }
        canvas.width = img.width;
        canvas.height = img.height;
        context.drawImage(img, 0, 0, img.width, img.height);
        return context;
    },
    resolveURL(path) {
        if (!linkEl)
            linkEl = document.createElement('a');
        linkEl.href = path;
        return linkEl.href;
    },
    hardwareConcurrency: typeof navigator !== 'undefined' && navigator.hardwareConcurrency || 4,
    get prefersReducedMotion() {
        if (!matchMedia)
            return false;
        if (reducedMotionQuery == null) {
            reducedMotionQuery = matchMedia('(prefers-reduced-motion: reduce)');
        }
        return reducedMotionQuery.matches;
    },
};
//# sourceMappingURL=browser.js.map