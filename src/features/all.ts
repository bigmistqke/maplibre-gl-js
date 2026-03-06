import type {Feature} from '../core/feature';
import {background} from './background';
import {circle} from './circle';
import {colorRelief} from './color_relief';
import {elevation} from './elevation';
import {fill} from './fill';
import {fillExtrusion} from './fill_extrusion';
import {geojson} from './geojson';
import {heatmap} from './heatmap';
import {hillshade} from './hillshade';
import {labels} from './symbol';
import {line} from './line';
import {raster, image, video, canvas} from './raster';
import {sky} from './sky';
import {vectorTiles} from './vector_tiles';

/** All available features — equivalent to current monolithic MapLibre. */
export function allFeatures(): Feature[] {
    return [
        vectorTiles(),
        geojson(),
        elevation(),
        raster(),
        image,
        video,
        canvas,
        fill(),
        line(),
        circle(),
        labels(),
        background(),
        heatmap(),
        fillExtrusion(),
        hillshade(),
        colorRelief(),
        sky(),
    ];
}
