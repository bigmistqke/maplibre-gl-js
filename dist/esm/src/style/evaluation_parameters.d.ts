import { ZoomHistory } from './zoom_history';
import type { GlobalProperties, TransitionSpecification } from '@maplibre/maplibre-gl-style-spec';
export type CrossfadeParameters = {
    fromScale: number;
    toScale: number;
    t: number;
};
export declare class EvaluationParameters implements GlobalProperties {
    zoom: number;
    now: number;
    fadeDuration: number;
    zoomHistory: ZoomHistory;
    transition: TransitionSpecification;
    isSupportedScript: (_: string) => boolean;
    constructor(zoom: number, options?: any);
    crossFadingFactor(): number;
    getCrossfadeParameters(): CrossfadeParameters;
}
//# sourceMappingURL=evaluation_parameters.d.ts.map