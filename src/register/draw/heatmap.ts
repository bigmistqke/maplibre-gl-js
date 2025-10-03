import {registerDrawFunction} from '../../render/draw_registry';
import {drawHeatmap} from '../../render/draw_heatmap';

registerDrawFunction('heatmap', drawHeatmap);
