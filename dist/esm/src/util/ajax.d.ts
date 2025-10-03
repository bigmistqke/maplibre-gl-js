export declare const GLOBAL_DISPATCHER_ID = "global-dispatcher";
export type ExpiryData = {
    cacheControl?: string | null;
    expires?: Date | string | null;
};
export type RequestParameters = {
    url: string;
    headers?: any;
    method?: 'GET' | 'POST' | 'PUT';
    body?: string;
    type?: 'string' | 'json' | 'arrayBuffer' | 'image';
    credentials?: 'same-origin' | 'include';
    collectResourceTiming?: boolean;
    cache?: RequestCache;
};
export type GetResourceResponse<T> = ExpiryData & {
    data: T;
};
export type ResponseCallback<T> = (error?: Error | null, data?: T | null, cacheControl?: string | null, expires?: string | Date | null) => void;
export declare class AJAXError extends Error {
    status: number;
    statusText: string;
    url: string;
    body: Blob;
    constructor(status: number, statusText: string, url: string, body: Blob);
}
export declare const getReferrer: () => string;
export declare const makeRequest: (requestParameters: RequestParameters, abortController: AbortController) => Promise<GetResourceResponse<any>>;
export declare const getJSON: <T>(requestParameters: RequestParameters, abortController: AbortController) => Promise<{
    data: T;
} & ExpiryData>;
export declare const getArrayBuffer: (requestParameters: RequestParameters, abortController: AbortController) => Promise<{
    data: ArrayBuffer;
} & ExpiryData>;
export declare function sameOrigin(inComingUrl: string): boolean;
export declare const getVideo: (urls: Array<string>) => Promise<HTMLVideoElement>;
//# sourceMappingURL=ajax.d.ts.map