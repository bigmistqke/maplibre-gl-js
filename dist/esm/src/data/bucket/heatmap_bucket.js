import { CircleBucket } from './circle_bucket';
import { register } from '../../util/web_worker_transfer';
export class HeatmapBucket extends CircleBucket {
}
register('HeatmapBucket', HeatmapBucket, { omit: ['layers'] });
//# sourceMappingURL=heatmap_bucket.js.map