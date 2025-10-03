import { type RequestParameters, type GetResourceResponse } from './ajax';
type ImageQueueThrottleControlCallback = () => boolean;
export type ImageRequestQueueItem = {
    requestParameters: RequestParameters;
    supportImageRefresh: boolean;
    state: 'queued' | 'running' | 'completed';
    abortController: AbortController;
    onError: (error: Error) => void;
    onSuccess: (response: GetResourceResponse<HTMLImageElement | ImageBitmap | null>) => void;
};
export declare namespace ImageRequest {
    const resetRequestQueue: () => void;
    const addThrottleControl: (callback: ImageQueueThrottleControlCallback) => number;
    const removeThrottleControl: (callbackHandle: number) => void;
    const getImage: (requestParameters: RequestParameters, abortController: AbortController, supportImageRefresh?: boolean) => Promise<GetResourceResponse<HTMLImageElement | ImageBitmap | null>>;
}
export {};
//# sourceMappingURL=image_request.d.ts.map