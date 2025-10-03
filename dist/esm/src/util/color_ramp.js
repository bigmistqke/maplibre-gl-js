import { RGBAImage } from './image';
import { isPowerOfTwo } from './util';
export function renderColorRamp(params) {
    const evaluationGlobals = {};
    const width = params.resolution || 256;
    const height = params.clips ? params.clips.length : 1;
    const image = params.image || new RGBAImage({ width, height });
    if (!isPowerOfTwo(width))
        throw new Error(`width is not a power of 2 - ${width}`);
    const renderPixel = (stride, index, progress) => {
        evaluationGlobals[params.evaluationKey] = progress;
        const pxColor = params.expression.evaluate(evaluationGlobals);
        image.setPixel(stride / 4 / width, index / 4, pxColor);
    };
    if (!params.clips) {
        for (let i = 0, j = 0; i < width; i++, j += 4) {
            const progress = i / (width - 1);
            renderPixel(0, j, progress);
        }
    }
    else {
        for (let clip = 0, stride = 0; clip < height; ++clip, stride += width * 4) {
            for (let i = 0, j = 0; i < width; i++, j += 4) {
                const progress = i / (width - 1);
                const { start, end } = params.clips[clip];
                const evaluationProgress = start * (1 - progress) + end * progress;
                renderPixel(stride, j, evaluationProgress);
            }
        }
    }
    return image;
}
//# sourceMappingURL=color_ramp.js.map