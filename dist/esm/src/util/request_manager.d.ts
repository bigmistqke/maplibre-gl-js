import type { RequestParameters } from './ajax';
export declare const enum ResourceType {
    Glyphs = "Glyphs",
    Image = "Image",
    Source = "Source",
    SpriteImage = "SpriteImage",
    SpriteJSON = "SpriteJSON",
    Style = "Style",
    Tile = "Tile",
    Unknown = "Unknown"
}
export type RequestTransformFunction = (url: string, resourceType?: ResourceType) => RequestParameters | undefined;
export declare class RequestManager {
    _transformRequestFn: RequestTransformFunction | null;
    constructor(transformRequestFn?: RequestTransformFunction | null);
    transformRequest(url: string, type: ResourceType): RequestParameters;
    setTransformRequest(transformRequest: RequestTransformFunction | null): void;
}
//# sourceMappingURL=request_manager.d.ts.map