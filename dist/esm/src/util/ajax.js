var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { extend, isWorker } from './util';
import { createAbortError } from './abort_error';
import { getProtocol } from '../source/protocol_crud';
export const GLOBAL_DISPATCHER_ID = 'global-dispatcher';
export class AJAXError extends Error {
    constructor(status, statusText, url, body) {
        super(`AJAXError: ${statusText} (${status}): ${url}`);
        this.status = status;
        this.statusText = statusText;
        this.url = url;
        this.body = body;
    }
}
export const getReferrer = () => isWorker(self) ?
    self.worker && self.worker.referrer :
    (window.location.protocol === 'blob:' ? window.parent : window).location.href;
const isFileURL = url => /^file:/.test(url) || (/^file:/.test(getReferrer()) && !/^\w+:/.test(url));
function makeFetchRequest(requestParameters, abortController) {
    return __awaiter(this, void 0, void 0, function* () {
        const request = new Request(requestParameters.url, {
            method: requestParameters.method || 'GET',
            body: requestParameters.body,
            credentials: requestParameters.credentials,
            headers: requestParameters.headers,
            cache: requestParameters.cache,
            referrer: getReferrer(),
            signal: abortController.signal
        });
        if (requestParameters.type === 'json' && !request.headers.has('Accept')) {
            request.headers.set('Accept', 'application/json');
        }
        let response;
        try {
            response = yield fetch(request);
        }
        catch (e) {
            throw new AJAXError(0, e.message, requestParameters.url, new Blob());
        }
        if (!response.ok) {
            const body = yield response.blob();
            throw new AJAXError(response.status, response.statusText, requestParameters.url, body);
        }
        let parsePromise;
        if ((requestParameters.type === 'arrayBuffer' || requestParameters.type === 'image')) {
            parsePromise = response.arrayBuffer();
        }
        else if (requestParameters.type === 'json') {
            parsePromise = response.json();
        }
        else {
            parsePromise = response.text();
        }
        const result = yield parsePromise;
        if (abortController.signal.aborted) {
            throw createAbortError();
        }
        return { data: result, cacheControl: response.headers.get('Cache-Control'), expires: response.headers.get('Expires') };
    });
}
function makeXMLHttpRequest(requestParameters, abortController) {
    return new Promise((resolve, reject) => {
        var _a;
        const xhr = new XMLHttpRequest();
        xhr.open(requestParameters.method || 'GET', requestParameters.url, true);
        if (requestParameters.type === 'arrayBuffer' || requestParameters.type === 'image') {
            xhr.responseType = 'arraybuffer';
        }
        for (const k in requestParameters.headers) {
            xhr.setRequestHeader(k, requestParameters.headers[k]);
        }
        if (requestParameters.type === 'json') {
            xhr.responseType = 'text';
            if (!((_a = requestParameters.headers) === null || _a === void 0 ? void 0 : _a.Accept)) {
                xhr.setRequestHeader('Accept', 'application/json');
            }
        }
        xhr.withCredentials = requestParameters.credentials === 'include';
        xhr.onerror = () => {
            reject(new Error(xhr.statusText));
        };
        xhr.onload = () => {
            if (abortController.signal.aborted) {
                return;
            }
            if (((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) && xhr.response !== null) {
                let data = xhr.response;
                if (requestParameters.type === 'json') {
                    try {
                        data = JSON.parse(xhr.response);
                    }
                    catch (err) {
                        reject(err);
                        return;
                    }
                }
                resolve({ data, cacheControl: xhr.getResponseHeader('Cache-Control'), expires: xhr.getResponseHeader('Expires') });
            }
            else {
                const body = new Blob([xhr.response], { type: xhr.getResponseHeader('Content-Type') });
                reject(new AJAXError(xhr.status, xhr.statusText, requestParameters.url, body));
            }
        };
        abortController.signal.addEventListener('abort', () => {
            xhr.abort();
            reject(createAbortError());
        });
        xhr.send(requestParameters.body);
    });
}
export const makeRequest = function (requestParameters, abortController) {
    if (/:\/\//.test(requestParameters.url) && !(/^https?:|^file:/.test(requestParameters.url))) {
        const protocolLoadFn = getProtocol(requestParameters.url);
        if (protocolLoadFn) {
            return protocolLoadFn(requestParameters, abortController);
        }
        if (isWorker(self) && self.worker && self.worker.actor) {
            return self.worker.actor.sendAsync({ type: "GR", data: requestParameters, targetMapId: GLOBAL_DISPATCHER_ID }, abortController);
        }
    }
    if (!isFileURL(requestParameters.url)) {
        if (fetch && Request && AbortController && Object.prototype.hasOwnProperty.call(Request.prototype, 'signal')) {
            return makeFetchRequest(requestParameters, abortController);
        }
        if (isWorker(self) && self.worker && self.worker.actor) {
            return self.worker.actor.sendAsync({ type: "GR", data: requestParameters, mustQueue: true, targetMapId: GLOBAL_DISPATCHER_ID }, abortController);
        }
    }
    return makeXMLHttpRequest(requestParameters, abortController);
};
export const getJSON = (requestParameters, abortController) => {
    return makeRequest(extend(requestParameters, { type: 'json' }), abortController);
};
export const getArrayBuffer = (requestParameters, abortController) => {
    return makeRequest(extend(requestParameters, { type: 'arrayBuffer' }), abortController);
};
export function sameOrigin(inComingUrl) {
    if (!inComingUrl ||
        inComingUrl.indexOf('://') <= 0 ||
        inComingUrl.indexOf('data:image/') === 0 ||
        inComingUrl.indexOf('blob:') === 0) {
        return true;
    }
    const urlObj = new URL(inComingUrl);
    const locationObj = window.location;
    return urlObj.protocol === locationObj.protocol && urlObj.host === locationObj.host;
}
export const getVideo = (urls) => {
    const video = window.document.createElement('video');
    video.muted = true;
    return new Promise((resolve) => {
        video.onloadstart = () => {
            resolve(video);
        };
        for (const url of urls) {
            const s = window.document.createElement('source');
            if (!sameOrigin(url)) {
                video.crossOrigin = 'Anonymous';
            }
            s.src = url;
            video.appendChild(s);
        }
    });
};
//# sourceMappingURL=ajax.js.map