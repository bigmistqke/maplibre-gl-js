import { Uniform1i, Uniform1f, Uniform2f } from '../uniform_binding';
import { pixelsToTileUnits } from '../../source/pixels_to_tile_units';
import { EXTENT } from '../../data/extent';
const circleUniforms = (context, locations) => ({
    'u_camera_to_center_distance': new Uniform1f(context, locations.u_camera_to_center_distance),
    'u_scale_with_map': new Uniform1i(context, locations.u_scale_with_map),
    'u_pitch_with_map': new Uniform1i(context, locations.u_pitch_with_map),
    'u_extrude_scale': new Uniform2f(context, locations.u_extrude_scale),
    'u_device_pixel_ratio': new Uniform1f(context, locations.u_device_pixel_ratio),
    'u_globe_extrude_scale': new Uniform1f(context, locations.u_globe_extrude_scale),
    'u_translate': new Uniform2f(context, locations.u_translate),
});
const circleUniformValues = (painter, tile, layer, translate, radiusCorrectionFactor) => {
    const transform = painter.transform;
    let pitchWithMap, extrudeScale;
    let globeExtrudeScale = 0;
    if (layer.paint.get('circle-pitch-alignment') === 'map') {
        const pixelRatio = pixelsToTileUnits(tile, 1, transform.zoom);
        pitchWithMap = true;
        extrudeScale = [pixelRatio, pixelRatio];
        globeExtrudeScale = pixelRatio / (EXTENT * Math.pow(2, tile.tileID.overscaledZ)) * 2.0 * Math.PI * radiusCorrectionFactor;
    }
    else {
        pitchWithMap = false;
        extrudeScale = transform.pixelsToGLUnits;
    }
    return {
        'u_camera_to_center_distance': transform.cameraToCenterDistance,
        'u_scale_with_map': +(layer.paint.get('circle-pitch-scale') === 'map'),
        'u_pitch_with_map': +(pitchWithMap),
        'u_device_pixel_ratio': painter.pixelRatio,
        'u_extrude_scale': extrudeScale,
        'u_globe_extrude_scale': globeExtrudeScale,
        'u_translate': translate,
    };
};
export { circleUniforms, circleUniformValues };
//# sourceMappingURL=circle_program.js.map