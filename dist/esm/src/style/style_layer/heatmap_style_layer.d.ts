import { type QueryIntersectsFeatureParams, StyleLayer } from '../style_layer';
import { type HeatmapPaintPropsPossiblyEvaluated } from './heatmap_style_layer_properties.g';
import type { HeatmapBucket } from '../../data/bucket/heatmap_bucket';
import type { RGBAImage } from '../../util/image';
import type { Transitionable, Transitioning, PossiblyEvaluated } from '../properties';
import type { Texture } from '../../render/texture';
import type { Framebuffer } from '../../gl/framebuffer';
import type { HeatmapPaintProps } from './heatmap_style_layer_properties.g';
import type { LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Bucket } from '../../data/bucket';
export declare const HEATMAP_FULL_RENDER_FBO_KEY = "big-fb";
export declare const isHeatmapStyleLayer: (layer: StyleLayer) => layer is HeatmapStyleLayer;
export declare class HeatmapStyleLayer extends StyleLayer {
    heatmapFbos: Map<string, Framebuffer>;
    colorRamp: RGBAImage;
    colorRampTexture: Texture;
    _transitionablePaint: Transitionable<HeatmapPaintProps>;
    _transitioningPaint: Transitioning<HeatmapPaintProps>;
    paint: PossiblyEvaluated<HeatmapPaintProps, HeatmapPaintPropsPossiblyEvaluated>;
    createBucket(options: any): HeatmapBucket;
    constructor(layer: LayerSpecification, globalState: Record<string, any>);
    _handleSpecialPaintPropertyUpdate(name: string): void;
    _updateColorRamp(): void;
    resize(): void;
    queryRadius(bucket: Bucket): number;
    queryIntersectsFeature({ queryGeometry, feature, featureState, geometry, transform, pixelsToTileUnits, unwrappedTileID, getElevation }: QueryIntersectsFeatureParams): boolean;
    hasOffscreenPass(): boolean;
}
//# sourceMappingURL=heatmap_style_layer.d.ts.map