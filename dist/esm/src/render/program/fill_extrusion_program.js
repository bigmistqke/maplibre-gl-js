import { patternUniformValues } from './pattern';
import { Uniform1i, Uniform1f, Uniform2f, Uniform3f } from '../uniform_binding';
import { mat3, vec3 } from 'gl-matrix';
import { extend } from '../../util/util';
const fillExtrusionUniforms = (context, locations) => ({
    'u_lightpos': new Uniform3f(context, locations.u_lightpos),
    'u_lightpos_globe': new Uniform3f(context, locations.u_lightpos_globe),
    'u_lightintensity': new Uniform1f(context, locations.u_lightintensity),
    'u_lightcolor': new Uniform3f(context, locations.u_lightcolor),
    'u_vertical_gradient': new Uniform1f(context, locations.u_vertical_gradient),
    'u_opacity': new Uniform1f(context, locations.u_opacity),
    'u_fill_translate': new Uniform2f(context, locations.u_fill_translate),
});
const fillExtrusionPatternUniforms = (context, locations) => ({
    'u_lightpos': new Uniform3f(context, locations.u_lightpos),
    'u_lightpos_globe': new Uniform3f(context, locations.u_lightpos_globe),
    'u_lightintensity': new Uniform1f(context, locations.u_lightintensity),
    'u_lightcolor': new Uniform3f(context, locations.u_lightcolor),
    'u_vertical_gradient': new Uniform1f(context, locations.u_vertical_gradient),
    'u_height_factor': new Uniform1f(context, locations.u_height_factor),
    'u_opacity': new Uniform1f(context, locations.u_opacity),
    'u_fill_translate': new Uniform2f(context, locations.u_fill_translate),
    'u_image': new Uniform1i(context, locations.u_image),
    'u_texsize': new Uniform2f(context, locations.u_texsize),
    'u_pixel_coord_upper': new Uniform2f(context, locations.u_pixel_coord_upper),
    'u_pixel_coord_lower': new Uniform2f(context, locations.u_pixel_coord_lower),
    'u_scale': new Uniform3f(context, locations.u_scale),
    'u_fade': new Uniform1f(context, locations.u_fade)
});
const fillExtrusionUniformValues = (painter, shouldUseVerticalGradient, opacity, translate) => {
    const light = painter.style.light;
    const _lp = light.properties.get('position');
    const lightPos = [_lp.x, _lp.y, _lp.z];
    const lightMat = mat3.create();
    if (light.properties.get('anchor') === 'viewport') {
        mat3.fromRotation(lightMat, painter.transform.bearingInRadians);
    }
    vec3.transformMat3(lightPos, lightPos, lightMat);
    const transformedLightPos = painter.transform.transformLightDirection(lightPos);
    const lightColor = light.properties.get('color');
    return {
        'u_lightpos': lightPos,
        'u_lightpos_globe': transformedLightPos,
        'u_lightintensity': light.properties.get('intensity'),
        'u_lightcolor': [lightColor.r, lightColor.g, lightColor.b],
        'u_vertical_gradient': +shouldUseVerticalGradient,
        'u_opacity': opacity,
        'u_fill_translate': translate,
    };
};
const fillExtrusionPatternUniformValues = (painter, shouldUseVerticalGradient, opacity, translate, coord, crossfade, tile) => {
    return extend(fillExtrusionUniformValues(painter, shouldUseVerticalGradient, opacity, translate), patternUniformValues(crossfade, painter, tile), {
        'u_height_factor': -Math.pow(2, coord.overscaledZ) / tile.tileSize / 8
    });
};
export { fillExtrusionUniforms, fillExtrusionPatternUniforms, fillExtrusionUniformValues, fillExtrusionPatternUniformValues };
//# sourceMappingURL=fill_extrusion_program.js.map