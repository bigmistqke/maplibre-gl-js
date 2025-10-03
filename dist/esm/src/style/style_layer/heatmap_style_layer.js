import { StyleLayer } from '../style_layer';
import { HeatmapBucket } from '../../data/bucket/heatmap_bucket';
import properties from './heatmap_style_layer_properties.g';
import { renderColorRamp } from '../../util/color_ramp';
import { circleIntersection, getMaximumPaintValue } from '../query_utils';
export const HEATMAP_FULL_RENDER_FBO_KEY = 'big-fb';
export const isHeatmapStyleLayer = (layer) => layer.type === 'heatmap';
export class HeatmapStyleLayer extends StyleLayer {
    createBucket(options) {
        return new HeatmapBucket(options);
    }
    constructor(layer, globalState) {
        super(layer, properties, globalState);
        this.heatmapFbos = new Map();
        this._updateColorRamp();
    }
    _handleSpecialPaintPropertyUpdate(name) {
        if (name === 'heatmap-color') {
            this._updateColorRamp();
        }
    }
    _updateColorRamp() {
        const expression = this._transitionablePaint._values['heatmap-color'].value.expression;
        this.colorRamp = renderColorRamp({
            expression,
            evaluationKey: 'heatmapDensity',
            image: this.colorRamp
        });
        this.colorRampTexture = null;
    }
    resize() {
        if (this.heatmapFbos.has(HEATMAP_FULL_RENDER_FBO_KEY)) {
            this.heatmapFbos.delete(HEATMAP_FULL_RENDER_FBO_KEY);
        }
    }
    queryRadius(bucket) {
        return getMaximumPaintValue('heatmap-radius', this, bucket);
    }
    queryIntersectsFeature({ queryGeometry, feature, featureState, geometry, transform, pixelsToTileUnits, unwrappedTileID, getElevation }) {
        return circleIntersection({
            queryGeometry,
            size: this.paint.get('heatmap-radius').evaluate(feature, featureState) * pixelsToTileUnits,
            transform,
            unwrappedTileID,
            getElevation
        }, geometry);
    }
    hasOffscreenPass() {
        return this.paint.get('heatmap-opacity') !== 0 && this.visibility !== 'none';
    }
}
//# sourceMappingURL=heatmap_style_layer.js.map