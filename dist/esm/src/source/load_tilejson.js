var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { pick, extend } from '../util/util';
import { getJSON } from '../util/ajax';
import { browser } from '../util/browser';
export function loadTileJson(options, requestManager, abortController) {
    return __awaiter(this, void 0, void 0, function* () {
        let tileJSON = options;
        if (options.url) {
            const response = yield getJSON(requestManager.transformRequest(options.url, "Source"), abortController);
            tileJSON = response.data;
        }
        else {
            yield browser.frameAsync(abortController);
        }
        if (!tileJSON) {
            return null;
        }
        const result = pick(extend(tileJSON, options), ['tiles', 'minzoom', 'maxzoom', 'attribution', 'bounds', 'scheme', 'tileSize', 'encoding']);
        if ('vector_layers' in tileJSON && tileJSON.vector_layers) {
            result.vectorLayerIds = tileJSON.vector_layers.map((layer) => { return layer.id; });
        }
        return result;
    });
}
//# sourceMappingURL=load_tilejson.js.map