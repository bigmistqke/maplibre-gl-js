/**
 * Registers all core draw functions (excluding symbol)
 * Symbol draw function is registered separately in register/symbol.ts for tree-shaking
 */
import {registerDrawFunction} from '../render/draw_registry';

import {drawBackground} from '../render/draw_background';
import {drawCircles} from '../render/draw_circle';
import {drawFill} from '../render/draw_fill';
import {drawFillExtrusion} from '../render/draw_fill_extrusion';
import {drawHeatmap} from '../render/draw_heatmap';
import {drawHillshade} from '../render/draw_hillshade';
import {drawLine} from '../render/draw_line';
import {drawRaster} from '../render/draw_raster';

registerDrawFunction('background', drawBackground);
registerDrawFunction('circle', drawCircles);
registerDrawFunction('fill', drawFill);
registerDrawFunction('fill-extrusion', drawFillExtrusion);
registerDrawFunction('heatmap', drawHeatmap);
registerDrawFunction('hillshade', drawHillshade);
registerDrawFunction('line', drawLine);
registerDrawFunction('raster', drawRaster);
registerDrawFunction('color-relief', drawRaster); // color-relief uses raster drawing
