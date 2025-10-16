import {type QueryIntersectsFeatureParams, StyleLayer} from '../style_layer';

import {HeatmapBucket} from '../../data/bucket/heatmap_bucket';
import {type RGBAImage} from '../../util/image';
import properties, {type HeatmapPaintPropsPossiblyEvaluated} from './heatmap_style_layer_properties.g';
import {renderColorRamp} from '../../util/color_ramp';
import {type Transitionable, type Transitioning, type PossiblyEvaluated} from '../properties';

import type {Texture} from '../../render/texture';
import type {Framebuffer} from '../../gl/framebuffer';
import type {HeatmapPaintProps} from './heatmap_style_layer_properties.g';
import type {LayerSpecification} from '@maplibre/maplibre-gl-style-spec';

import {circleIntersection, getMaximumPaintValue} from '../query_utils';
import type {Bucket} from '../../data/bucket';
import { assertedNotNullish } from "../../util/util";

export const HEATMAP_FULL_RENDER_FBO_KEY = 'big-fb';

export const isHeatmapStyleLayer = (layer: StyleLayer): layer is HeatmapStyleLayer => layer.type === 'heatmap';

/**
 * A style layer that defines a heatmap
 */
export class HeatmapStyleLayer extends StyleLayer {

    heatmapFbos: Map<string, Framebuffer>;
    colorRamp: RGBAImage | undefined;
    colorRampTexture: Texture | undefined;

    _transitionablePaint: Transitionable<HeatmapPaintProps> | undefined;
    _transitioningPaint: Transitioning<HeatmapPaintProps> | undefined;
    paint: PossiblyEvaluated<HeatmapPaintProps, HeatmapPaintPropsPossiblyEvaluated> | undefined;

    createBucket(options: any) {
        return new HeatmapBucket(options);
    }

    constructor(layer: LayerSpecification, globalState: Record<string, any>) {
        super(layer, properties, globalState);

        this.heatmapFbos = new Map();
        // make sure color ramp texture is generated for default heatmap color too
        this._updateColorRamp();
    }

    _handleSpecialPaintPropertyUpdate(name: string) {
        if (name === 'heatmap-color') {
            this._updateColorRamp();
        }
    }

    _updateColorRamp() {
        const expression = assertedNotNullish(this._transitionablePaint)._values['heatmap-color'].value.expression;
        this.colorRamp = renderColorRamp({
            expression,
            evaluationKey: 'heatmapDensity',
            image: this.colorRamp
        });
        this.colorRampTexture = undefined;
    }

    resize() {
        if (this.heatmapFbos.has(HEATMAP_FULL_RENDER_FBO_KEY)) {
            this.heatmapFbos.delete(HEATMAP_FULL_RENDER_FBO_KEY);
        }
    }

    queryRadius(bucket: Bucket): number {
        return getMaximumPaintValue('heatmap-radius', this, bucket as HeatmapBucket);
    }

    queryIntersectsFeature({
        queryGeometry,
        feature,
        featureState,
        geometry,
        transform,
        pixelsToTileUnits,
        unwrappedTileID,
        getElevation}: QueryIntersectsFeatureParams
    ): boolean {
        return circleIntersection({
            queryGeometry,
            size: assertedNotNullish(this.paint).get('heatmap-radius').evaluate(feature, featureState) * pixelsToTileUnits,
            transform,
            unwrappedTileID,
            getElevation
        }, geometry);
    }

    hasOffscreenPass() {
        return assertedNotNullish(this.paint).get('heatmap-opacity') !== 0 && this.visibility !== 'none';
    }
}
