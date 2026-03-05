import {CircleBucket} from './circle_bucket';
import {register} from '../../util/web_worker_transfer';

import type {HeatmapStyleLayer} from '../../style/style_layer/heatmap_style_layer';
import type {BucketParameters} from '../bucket';

export class HeatmapBucket extends CircleBucket<HeatmapStyleLayer> {
    // Needed for flow to accept omit: ['layers'] below, due to
    // https://github.com/facebook/flow/issues/4262
    layers: Array<HeatmapStyleLayer>;

    constructor(options: BucketParameters<HeatmapStyleLayer>){
        super(options);
        this.layers = [];
    }
}

register('HeatmapBucket', HeatmapBucket, {omit: ['layers']});
