import {RasterTileSource} from '../source/raster_tile_source';
import {RasterStyleLayer} from '../style/style_layer/raster_style_layer';
import {drawRaster} from '../render/draw_raster';
import {rasterUniforms} from '../render/program/raster_program';
import {prepare} from '../shaders/shaders';
import rasterFrag from '../shaders/raster.fragment.glsl.g';
import rasterVert from '../shaders/raster.vertex.glsl.g';
import type {Feature} from '../core/feature';
import {merge} from '../core/feature';
import {ImageSource} from '../source/image_source';
import {VideoSource} from '../source/video_source';
import {CanvasSource} from '../source/canvas_source';

const rasterBase: Feature = {
    sources: {
        raster: {Source: RasterTileSource},
    },
    layers: {
        raster: {
            StyleLayer: RasterStyleLayer,
            draw: drawRaster,
        }
    },
    programs: {
        raster: {uniforms: rasterUniforms, shaderSource: prepare(rasterFrag, rasterVert)},
    },
};

export function raster(...features: Feature[]): Feature {
    return merge(rasterBase, ...features);
}

export const image: Feature = {
    sources: {image: {Source: ImageSource}},
};

export const video: Feature = {
    sources: {video: {Source: VideoSource}},
};

export const canvas: Feature = {
    sources: {canvas: {Source: CanvasSource}},
};
