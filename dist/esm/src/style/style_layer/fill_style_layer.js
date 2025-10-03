import { StyleLayer } from '../style_layer';
import { FillBucket } from '../../data/bucket/fill_bucket';
import { polygonIntersectsMultiPolygon } from '../../util/intersection_tests';
import { translateDistance, translate } from '../query_utils';
import properties from './fill_style_layer_properties.g';
export const isFillStyleLayer = (layer) => layer.type === 'fill';
export class FillStyleLayer extends StyleLayer {
    constructor(layer, globalState) {
        super(layer, properties, globalState);
    }
    recalculate(parameters, availableImages) {
        super.recalculate(parameters, availableImages);
        const outlineColor = this.paint._values['fill-outline-color'];
        if (outlineColor.value.kind === 'constant' && outlineColor.value.value === undefined) {
            this.paint._values['fill-outline-color'] = this.paint._values['fill-color'];
        }
    }
    createBucket(parameters) {
        return new FillBucket(parameters);
    }
    queryRadius() {
        return translateDistance(this.paint.get('fill-translate'));
    }
    queryIntersectsFeature({ queryGeometry, geometry, transform, pixelsToTileUnits }) {
        const translatedPolygon = translate(queryGeometry, this.paint.get('fill-translate'), this.paint.get('fill-translate-anchor'), -transform.bearingInRadians, pixelsToTileUnits);
        return polygonIntersectsMultiPolygon(translatedPolygon, geometry);
    }
    isTileClipped() {
        return true;
    }
}
//# sourceMappingURL=fill_style_layer.js.map