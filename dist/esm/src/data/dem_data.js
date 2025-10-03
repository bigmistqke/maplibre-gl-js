import { RGBAImage } from '../util/image';
import { warnOnce } from '../util/util';
import { register } from '../util/web_worker_transfer';
export class DEMData {
    constructor(uid, data, encoding, redFactor = 1.0, greenFactor = 1.0, blueFactor = 1.0, baseShift = 0.0) {
        this.uid = uid;
        if (data.height !== data.width)
            throw new RangeError('DEM tiles must be square');
        if (encoding && !['mapbox', 'terrarium', 'custom'].includes(encoding)) {
            warnOnce(`"${encoding}" is not a valid encoding type. Valid types include "mapbox", "terrarium" and "custom".`);
            return;
        }
        this.stride = data.height;
        const dim = this.dim = data.height - 2;
        this.data = new Uint32Array(data.data.buffer);
        switch (encoding) {
            case 'terrarium':
                this.redFactor = 256.0;
                this.greenFactor = 1.0;
                this.blueFactor = 1.0 / 256.0;
                this.baseShift = 32768.0;
                break;
            case 'custom':
                this.redFactor = redFactor;
                this.greenFactor = greenFactor;
                this.blueFactor = blueFactor;
                this.baseShift = baseShift;
                break;
            case 'mapbox':
            default:
                this.redFactor = 6553.6;
                this.greenFactor = 25.6;
                this.blueFactor = 0.1;
                this.baseShift = 10000.0;
                break;
        }
        for (let x = 0; x < dim; x++) {
            this.data[this._idx(-1, x)] = this.data[this._idx(0, x)];
            this.data[this._idx(dim, x)] = this.data[this._idx(dim - 1, x)];
            this.data[this._idx(x, -1)] = this.data[this._idx(x, 0)];
            this.data[this._idx(x, dim)] = this.data[this._idx(x, dim - 1)];
        }
        this.data[this._idx(-1, -1)] = this.data[this._idx(0, 0)];
        this.data[this._idx(dim, -1)] = this.data[this._idx(dim - 1, 0)];
        this.data[this._idx(-1, dim)] = this.data[this._idx(0, dim - 1)];
        this.data[this._idx(dim, dim)] = this.data[this._idx(dim - 1, dim - 1)];
        this.min = Number.MAX_SAFE_INTEGER;
        this.max = Number.MIN_SAFE_INTEGER;
        for (let x = 0; x < dim; x++) {
            for (let y = 0; y < dim; y++) {
                const ele = this.get(x, y);
                if (ele > this.max)
                    this.max = ele;
                if (ele < this.min)
                    this.min = ele;
            }
        }
    }
    get(x, y) {
        const pixels = new Uint8Array(this.data.buffer);
        const index = this._idx(x, y) * 4;
        return this.unpack(pixels[index], pixels[index + 1], pixels[index + 2]);
    }
    getUnpackVector() {
        return [this.redFactor, this.greenFactor, this.blueFactor, this.baseShift];
    }
    _idx(x, y) {
        if (x < -1 || x >= this.dim + 1 || y < -1 || y >= this.dim + 1)
            throw new RangeError('out of range source coordinates for DEM data');
        return (y + 1) * this.stride + (x + 1);
    }
    unpack(r, g, b) {
        return (r * this.redFactor + g * this.greenFactor + b * this.blueFactor - this.baseShift);
    }
    pack(v) {
        return packDEMData(v, this.getUnpackVector());
    }
    getPixels() {
        return new RGBAImage({ width: this.stride, height: this.stride }, new Uint8Array(this.data.buffer));
    }
    backfillBorder(borderTile, dx, dy) {
        if (this.dim !== borderTile.dim)
            throw new Error('dem dimension mismatch');
        let xMin = dx * this.dim, xMax = dx * this.dim + this.dim, yMin = dy * this.dim, yMax = dy * this.dim + this.dim;
        switch (dx) {
            case -1:
                xMin = xMax - 1;
                break;
            case 1:
                xMax = xMin + 1;
                break;
        }
        switch (dy) {
            case -1:
                yMin = yMax - 1;
                break;
            case 1:
                yMax = yMin + 1;
                break;
        }
        const ox = -dx * this.dim;
        const oy = -dy * this.dim;
        for (let y = yMin; y < yMax; y++) {
            for (let x = xMin; x < xMax; x++) {
                this.data[this._idx(x, y)] = borderTile.data[this._idx(x + ox, y + oy)];
            }
        }
    }
}
export function packDEMData(v, unpackVector) {
    const redFactor = unpackVector[0];
    const greenFactor = unpackVector[1];
    const blueFactor = unpackVector[2];
    const baseShift = unpackVector[3];
    const minScale = Math.min(redFactor, greenFactor, blueFactor);
    const vScaled = Math.round((v + baseShift) / minScale);
    return {
        r: Math.floor(vScaled * minScale / redFactor) % 256,
        g: Math.floor(vScaled * minScale / greenFactor) % 256,
        b: Math.floor(vScaled * minScale / blueFactor) % 256
    };
}
register('DEMData', DEMData);
//# sourceMappingURL=dem_data.js.map