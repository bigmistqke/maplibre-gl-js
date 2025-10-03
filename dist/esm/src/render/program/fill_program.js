import { patternUniformValues } from './pattern';
import { Uniform1i, Uniform1f, Uniform2f, Uniform3f, } from '../uniform_binding';
import { extend } from '../../util/util';
const fillUniforms = (context, locations) => ({
    'u_fill_translate': new Uniform2f(context, locations.u_fill_translate)
});
const fillPatternUniforms = (context, locations) => ({
    'u_image': new Uniform1i(context, locations.u_image),
    'u_texsize': new Uniform2f(context, locations.u_texsize),
    'u_pixel_coord_upper': new Uniform2f(context, locations.u_pixel_coord_upper),
    'u_pixel_coord_lower': new Uniform2f(context, locations.u_pixel_coord_lower),
    'u_scale': new Uniform3f(context, locations.u_scale),
    'u_fade': new Uniform1f(context, locations.u_fade),
    'u_fill_translate': new Uniform2f(context, locations.u_fill_translate)
});
const fillOutlineUniforms = (context, locations) => ({
    'u_world': new Uniform2f(context, locations.u_world),
    'u_fill_translate': new Uniform2f(context, locations.u_fill_translate)
});
const fillOutlinePatternUniforms = (context, locations) => ({
    'u_world': new Uniform2f(context, locations.u_world),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_texsize': new Uniform2f(context, locations.u_texsize),
    'u_pixel_coord_upper': new Uniform2f(context, locations.u_pixel_coord_upper),
    'u_pixel_coord_lower': new Uniform2f(context, locations.u_pixel_coord_lower),
    'u_scale': new Uniform3f(context, locations.u_scale),
    'u_fade': new Uniform1f(context, locations.u_fade),
    'u_fill_translate': new Uniform2f(context, locations.u_fill_translate)
});
const fillPatternUniformValues = (painter, crossfade, tile, translate) => extend(patternUniformValues(crossfade, painter, tile), {
    'u_fill_translate': translate,
});
const fillUniformValues = (translate) => ({
    'u_fill_translate': translate,
});
const fillOutlineUniformValues = (drawingBufferSize, translate) => ({
    'u_world': drawingBufferSize,
    'u_fill_translate': translate,
});
const fillOutlinePatternUniformValues = (painter, crossfade, tile, drawingBufferSize, translate) => extend(fillPatternUniformValues(painter, crossfade, tile, translate), {
    'u_world': drawingBufferSize
});
export { fillUniforms, fillPatternUniforms, fillOutlineUniforms, fillOutlinePatternUniforms, fillUniformValues, fillPatternUniformValues, fillOutlineUniformValues, fillOutlinePatternUniformValues };
//# sourceMappingURL=fill_program.js.map