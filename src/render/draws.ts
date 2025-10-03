/**
 * Registers all core draw functions (excluding symbol)
 * Symbol draw function is registered separately in draws/symbol.ts for tree-shaking
 */
import {registerDrawFunction} from './draw_registry';

import {drawBackground} from './draw_background';
import {drawCircles} from './draw_circle';
import {drawFill} from './draw_fill';
import {drawFillExtrusion} from './draw_fill_extrusion';
import {drawHeatmap} from './draw_heatmap';
import {drawHillshade} from './draw_hillshade';
import {drawLine} from './draw_line';
import {drawRaster} from './draw_raster';

registerDrawFunction('background', drawBackground);
registerDrawFunction('circle', drawCircles);
registerDrawFunction('fill', drawFill);
registerDrawFunction('fill-extrusion', drawFillExtrusion);
registerDrawFunction('heatmap', drawHeatmap);
registerDrawFunction('hillshade', drawHillshade);
registerDrawFunction('line', drawLine);
registerDrawFunction('raster', drawRaster);
registerDrawFunction('color-relief', drawRaster); // color-relief uses raster drawing
