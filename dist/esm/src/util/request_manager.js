export class RequestManager {
    constructor(transformRequestFn) {
        this._transformRequestFn = transformRequestFn !== null && transformRequestFn !== void 0 ? transformRequestFn : null;
    }
    transformRequest(url, type) {
        if (this._transformRequestFn) {
            return this._transformRequestFn(url, type) || { url };
        }
        return { url };
    }
    setTransformRequest(transformRequest) {
        this._transformRequestFn = transformRequest;
    }
}
//# sourceMappingURL=request_manager.js.map