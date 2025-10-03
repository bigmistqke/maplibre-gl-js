import {registerDrawFunction} from '../../render/draw_registry';
import {drawRaster} from '../../render/draw_raster';

registerDrawFunction('raster', drawRaster);
registerDrawFunction('color-relief', drawRaster); // color-relief uses raster drawing
