var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { DEMData } from '../data/dem_data';
import { RGBAImage } from '../util/image';
import { getImageData, isImageBitmap } from '../util/util';
export class RasterDEMTileWorkerSource {
    constructor() {
        this.loaded = {};
    }
    loadTile(params) {
        return __awaiter(this, void 0, void 0, function* () {
            const { uid, encoding, rawImageData, redFactor, greenFactor, blueFactor, baseShift } = params;
            const width = rawImageData.width + 2;
            const height = rawImageData.height + 2;
            const imagePixels = isImageBitmap(rawImageData) ?
                new RGBAImage({ width, height }, yield getImageData(rawImageData, -1, -1, width, height)) :
                rawImageData;
            const dem = new DEMData(uid, imagePixels, encoding, redFactor, greenFactor, blueFactor, baseShift);
            this.loaded = this.loaded || {};
            this.loaded[uid] = dem;
            return dem;
        });
    }
    removeTile(params) {
        const loaded = this.loaded, uid = params.uid;
        if (loaded && loaded[uid]) {
            delete loaded[uid];
        }
    }
}
//# sourceMappingURL=raster_dem_tile_worker_source.js.map