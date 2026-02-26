import {RasterTileSource} from '../source/raster_tile_source';
import {RasterStyleLayer} from '../style/style_layer/raster_style_layer';
import {drawRaster} from '../render/draw_raster';
import {rasterUniforms} from '../render/program/raster_program';
import type {Feature} from '../core/feature';
import {merge} from '../core/feature';

const rasterBase: Feature = {
    sources: {
        raster: {Source: RasterTileSource as any},
    },
    layers: {
        raster: {
            StyleLayer: RasterStyleLayer as any,
            draw: drawRaster as any,
        }
    },
    programs: {
        raster: {uniforms: rasterUniforms},
    },
};

export function raster(...capabilities: Feature[]): Feature {
    return merge(rasterBase, ...capabilities);
}
