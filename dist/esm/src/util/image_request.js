var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { makeRequest, sameOrigin } from './ajax';
import { arrayBufferToImageBitmap, arrayBufferToImage, extend, isWorker, isImageBitmap } from './util';
import { webpSupported } from './webp_supported';
import { config } from './config';
import { createAbortError } from './abort_error';
import { getProtocol } from '../source/protocol_crud';
export var ImageRequest;
(function (ImageRequest) {
    let imageRequestQueue;
    let currentParallelImageRequests;
    let throttleControlCallbackHandleCounter;
    let throttleControlCallbacks;
    ImageRequest.resetRequestQueue = () => {
        imageRequestQueue = [];
        currentParallelImageRequests = 0;
        throttleControlCallbackHandleCounter = 0;
        throttleControlCallbacks = {};
    };
    ImageRequest.addThrottleControl = (callback) => {
        const handle = throttleControlCallbackHandleCounter++;
        throttleControlCallbacks[handle] = callback;
        return handle;
    };
    ImageRequest.removeThrottleControl = (callbackHandle) => {
        delete throttleControlCallbacks[callbackHandle];
        processQueue();
    };
    const isThrottled = () => {
        for (const key of Object.keys(throttleControlCallbacks)) {
            if (throttleControlCallbacks[key]()) {
                return true;
            }
        }
        return false;
    };
    ImageRequest.getImage = (requestParameters, abortController, supportImageRefresh = true) => {
        return new Promise((resolve, reject) => {
            if (webpSupported.supported) {
                if (!requestParameters.headers) {
                    requestParameters.headers = {};
                }
                requestParameters.headers.accept = 'image/webp,*/*';
            }
            extend(requestParameters, { type: 'image' });
            const request = {
                abortController,
                requestParameters,
                supportImageRefresh,
                state: 'queued',
                onError: (error) => {
                    reject(error);
                },
                onSuccess: (response) => {
                    resolve(response);
                }
            };
            imageRequestQueue.push(request);
            processQueue();
        });
    };
    const arrayBufferToCanvasImageSource = (data) => {
        const imageBitmapSupported = typeof createImageBitmap === 'function';
        if (imageBitmapSupported) {
            return arrayBufferToImageBitmap(data);
        }
        else {
            return arrayBufferToImage(data);
        }
    };
    const doImageRequest = (itemInQueue) => __awaiter(this, void 0, void 0, function* () {
        itemInQueue.state = 'running';
        const { requestParameters, supportImageRefresh, onError, onSuccess, abortController } = itemInQueue;
        const canUseHTMLImageElement = supportImageRefresh === false &&
            !isWorker(self) &&
            !getProtocol(requestParameters.url) &&
            (!requestParameters.headers ||
                Object.keys(requestParameters.headers).reduce((acc, item) => acc && item === 'accept', true));
        currentParallelImageRequests++;
        const getImagePromise = canUseHTMLImageElement ?
            getImageUsingHtmlImage(requestParameters, abortController) :
            makeRequest(requestParameters, abortController);
        try {
            const response = yield getImagePromise;
            delete itemInQueue.abortController;
            itemInQueue.state = 'completed';
            if (response.data instanceof HTMLImageElement || isImageBitmap(response.data)) {
                onSuccess(response);
            }
            else if (response.data) {
                const img = yield arrayBufferToCanvasImageSource(response.data);
                onSuccess({ data: img, cacheControl: response.cacheControl, expires: response.expires });
            }
        }
        catch (err) {
            delete itemInQueue.abortController;
            onError(err);
        }
        finally {
            currentParallelImageRequests--;
            processQueue();
        }
    });
    const processQueue = () => {
        const maxImageRequests = isThrottled() ?
            config.MAX_PARALLEL_IMAGE_REQUESTS_PER_FRAME :
            config.MAX_PARALLEL_IMAGE_REQUESTS;
        for (let numImageRequests = currentParallelImageRequests; numImageRequests < maxImageRequests && imageRequestQueue.length > 0; numImageRequests++) {
            const topItemInQueue = imageRequestQueue.shift();
            if (topItemInQueue.abortController.signal.aborted) {
                numImageRequests--;
                continue;
            }
            doImageRequest(topItemInQueue);
        }
    };
    const getImageUsingHtmlImage = (requestParameters, abortController) => {
        return new Promise((resolve, reject) => {
            const image = new Image();
            const url = requestParameters.url;
            const credentials = requestParameters.credentials;
            if (credentials && credentials === 'include') {
                image.crossOrigin = 'use-credentials';
            }
            else if ((credentials && credentials === 'same-origin') || !sameOrigin(url)) {
                image.crossOrigin = 'anonymous';
            }
            abortController.signal.addEventListener('abort', () => {
                image.src = '';
                reject(createAbortError());
            });
            image.fetchPriority = 'high';
            image.onload = () => {
                image.onerror = image.onload = null;
                resolve({ data: image });
            };
            image.onerror = () => {
                image.onerror = image.onload = null;
                if (abortController.signal.aborted) {
                    return;
                }
                reject(new Error('Could not load image. Please make sure to use a supported image type such as PNG or JPEG. Note that SVGs are not supported.'));
            };
            image.src = url;
        });
    };
})(ImageRequest || (ImageRequest = {}));
ImageRequest.resetRequestQueue();
//# sourceMappingURL=image_request.js.map