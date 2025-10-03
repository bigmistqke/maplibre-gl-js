import Point from '@mapbox/point-geometry';
import { register } from '../util/web_worker_transfer';
export class Anchor extends Point {
    constructor(x, y, angle, segment) {
        super(x, y);
        this.angle = angle;
        if (segment !== undefined) {
            this.segment = segment;
        }
    }
    clone() {
        return new Anchor(this.x, this.y, this.angle, this.segment);
    }
}
register('Anchor', Anchor);
//# sourceMappingURL=anchor.js.map