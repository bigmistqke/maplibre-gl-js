import Point from '@mapbox/point-geometry';
import { applyTextFit } from './shaping';
export class CollisionFeature {
    constructor(collisionBoxArray, anchor, featureIndex, sourceLayerIndex, bucketIndex, shaped, boxScale, padding, alignLine, rotate) {
        var _a;
        this.boxStartIndex = collisionBoxArray.length;
        if (alignLine) {
            let top = shaped.top;
            let bottom = shaped.bottom;
            const collisionPadding = shaped.collisionPadding;
            if (collisionPadding) {
                top -= collisionPadding[1];
                bottom += collisionPadding[3];
            }
            let height = bottom - top;
            if (height > 0) {
                height = Math.max(10, height);
                this.circleDiameter = height;
            }
        }
        else {
            const icon = ((_a = shaped.image) === null || _a === void 0 ? void 0 : _a.content) && (shaped.image.textFitWidth || shaped.image.textFitHeight) ?
                applyTextFit(shaped) :
                {
                    x1: shaped.left,
                    y1: shaped.top,
                    x2: shaped.right,
                    y2: shaped.bottom
                };
            icon.y1 = icon.y1 * boxScale - padding[0];
            icon.y2 = icon.y2 * boxScale + padding[2];
            icon.x1 = icon.x1 * boxScale - padding[3];
            icon.x2 = icon.x2 * boxScale + padding[1];
            const collisionPadding = shaped.collisionPadding;
            if (collisionPadding) {
                icon.x1 -= collisionPadding[0] * boxScale;
                icon.y1 -= collisionPadding[1] * boxScale;
                icon.x2 += collisionPadding[2] * boxScale;
                icon.y2 += collisionPadding[3] * boxScale;
            }
            if (rotate) {
                const tl = new Point(icon.x1, icon.y1);
                const tr = new Point(icon.x2, icon.y1);
                const bl = new Point(icon.x1, icon.y2);
                const br = new Point(icon.x2, icon.y2);
                const rotateRadians = rotate * Math.PI / 180;
                tl._rotate(rotateRadians);
                tr._rotate(rotateRadians);
                bl._rotate(rotateRadians);
                br._rotate(rotateRadians);
                icon.x1 = Math.min(tl.x, tr.x, bl.x, br.x);
                icon.x2 = Math.max(tl.x, tr.x, bl.x, br.x);
                icon.y1 = Math.min(tl.y, tr.y, bl.y, br.y);
                icon.y2 = Math.max(tl.y, tr.y, bl.y, br.y);
            }
            collisionBoxArray.emplaceBack(anchor.x, anchor.y, icon.x1, icon.y1, icon.x2, icon.y2, featureIndex, sourceLayerIndex, bucketIndex);
        }
        this.boxEndIndex = collisionBoxArray.length;
    }
}
//# sourceMappingURL=collision_feature.js.map