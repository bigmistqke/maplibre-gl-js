import type { RequestParameters, GetResourceResponse } from './ajax';
export type AddProtocolAction = (requestParameters: RequestParameters, abortController: AbortController) => Promise<GetResourceResponse<any>>;
type Config = {
    MAX_PARALLEL_IMAGE_REQUESTS: number;
    MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME: number;
    MAX_TILE_CACHE_ZOOM_LEVELS: number;
    REGISTERED_PROTOCOLS: {
        [x: string]: AddProtocolAction;
    };
    WORKER_URL: string;
    WORKER_IS_MODULE: boolean;
};
export declare const config: Config;
export {};
//# sourceMappingURL=config.d.ts.map