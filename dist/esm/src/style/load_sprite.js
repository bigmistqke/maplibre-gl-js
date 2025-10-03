var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { getJSON } from '../util/ajax';
import { ImageRequest } from '../util/image_request';
import { browser } from '../util/browser';
import { coerceSpriteToArray } from '../util/style';
export function normalizeSpriteURL(url, format, extension) {
    try {
        const parsed = new URL(url);
        parsed.pathname += `${format}${extension}`;
        return parsed.toString();
    }
    catch (_a) {
        throw new Error(`Invalid sprite URL "${url}", must be absolute. Modify style specification directly or use TransformStyleFunction to correct the issue dynamically`);
    }
}
export function loadSprite(originalSprite, requestManager, pixelRatio, abortController) {
    return __awaiter(this, void 0, void 0, function* () {
        const spriteArray = coerceSpriteToArray(originalSprite);
        const format = pixelRatio > 1 ? '@2x' : '';
        const jsonsMap = {};
        const imagesMap = {};
        for (const { id, url } of spriteArray) {
            const jsonRequestParameters = requestManager.transformRequest(normalizeSpriteURL(url, format, '.json'), "SpriteJSON");
            jsonsMap[id] = getJSON(jsonRequestParameters, abortController);
            const imageRequestParameters = requestManager.transformRequest(normalizeSpriteURL(url, format, '.png'), "SpriteImage");
            imagesMap[id] = ImageRequest.getImage(imageRequestParameters, abortController);
        }
        yield Promise.all([...Object.values(jsonsMap), ...Object.values(imagesMap)]);
        return doOnceCompleted(jsonsMap, imagesMap);
    });
}
function doOnceCompleted(jsonsMap, imagesMap) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = {};
        for (const spriteName in jsonsMap) {
            result[spriteName] = {};
            const context = browser.getImageCanvasContext((yield imagesMap[spriteName]).data);
            const json = (yield jsonsMap[spriteName]).data;
            for (const id in json) {
                const { width, height, x, y, sdf, pixelRatio, stretchX, stretchY, content, textFitWidth, textFitHeight } = json[id];
                const spriteData = { width, height, x, y, context };
                result[spriteName][id] = { data: null, pixelRatio, sdf, stretchX, stretchY, content, textFitWidth, textFitHeight, spriteData };
            }
        }
        return result;
    });
}
//# sourceMappingURL=load_sprite.js.map