import { clamp } from '../util/util';
export function packUint8ToFloat(a, b) {
    a = clamp(Math.floor(a), 0, 255);
    b = clamp(Math.floor(b), 0, 255);
    return 256 * a + b;
}
//# sourceMappingURL=encode_attribute.js.map