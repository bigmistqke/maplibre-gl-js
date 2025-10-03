import { warnOnce, clamp } from '../util/util';
import { EXTENT } from './extent';
const BITS = 15;
const MAX = Math.pow(2, BITS - 1) - 1;
const MIN = -MAX - 1;
export function loadGeometry(feature) {
    const scale = EXTENT / feature.extent;
    const geometry = feature.loadGeometry();
    for (let r = 0; r < geometry.length; r++) {
        const ring = geometry[r];
        for (let p = 0; p < ring.length; p++) {
            const point = ring[p];
            const x = Math.round(point.x * scale);
            const y = Math.round(point.y * scale);
            point.x = clamp(x, MIN, MAX);
            point.y = clamp(y, MIN, MAX);
            if (x < point.x || x > point.x + 1 || y < point.y || y > point.y + 1) {
                warnOnce('Geometry exceeds allowed extent, reduce your vector tile buffer size');
            }
        }
    }
    return geometry;
}
//# sourceMappingURL=load_geometry.js.map