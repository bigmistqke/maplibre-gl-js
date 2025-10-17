import { StyleLayer } from '../style_layer';
import { circleIntersection, getMaximumPaintValue, projectQueryGeometry, translateDistance, translate } from '../query_utils';
import properties from './circle_style_layer_properties.g';
import { registry } from '../../registry';
export const isCircleStyleLayer = (layer) => layer.type === 'circle';
export class CircleStyleLayer extends StyleLayer {
    constructor(layer, globalState) {
        super(layer, properties, globalState);
    }
    createBucket(parameters) {
        return new registry.bucket.circle(parameters);
    }
    queryRadius(bucket) {
        const circleBucket = bucket;
        return getMaximumPaintValue('circle-radius', this, circleBucket) +
            getMaximumPaintValue('circle-stroke-width', this, circleBucket) +
            translateDistance(this.paint.get('circle-translate'));
    }
    queryIntersectsFeature({ queryGeometry, feature, featureState, geometry, transform, pixelsToTileUnits, unwrappedTileID, getElevation }) {
        const translatedPolygon = translate(queryGeometry, this.paint.get('circle-translate'), this.paint.get('circle-translate-anchor'), -transform.bearingInRadians, pixelsToTileUnits);
        const radius = this.paint.get('circle-radius').evaluate(feature, featureState);
        const stroke = this.paint.get('circle-stroke-width').evaluate(feature, featureState);
        const size = radius + stroke;
        const pitchScale = this.paint.get('circle-pitch-scale');
        const pitchAlignment = this.paint.get('circle-pitch-alignment');
        let transformedPolygon;
        let transformedSize;
        if (pitchAlignment === 'map') {
            transformedPolygon = translatedPolygon;
            transformedSize = size * pixelsToTileUnits;
        }
        else {
            transformedPolygon = projectQueryGeometry(translatedPolygon, transform, unwrappedTileID, getElevation);
            transformedSize = size;
        }
        return circleIntersection({
            queryGeometry: transformedPolygon,
            size: transformedSize,
            transform,
            unwrappedTileID,
            getElevation,
            pitchAlignment,
            pitchScale
        }, geometry);
    }
}
//# sourceMappingURL=circle_style_layer.js.map