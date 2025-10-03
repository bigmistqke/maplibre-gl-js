import { Uniform1i, Uniform1f, Uniform2f } from '../uniform_binding';
import type { Context } from '../../gl/context';
import type { UniformValues, UniformLocations } from '../uniform_binding';
import type { Tile } from '../../source/tile';
import type { CircleStyleLayer } from '../../style/style_layer/circle_style_layer';
import type { Painter } from '../painter';
export type CircleUniformsType = {
    'u_camera_to_center_distance': Uniform1f;
    'u_scale_with_map': Uniform1i;
    'u_pitch_with_map': Uniform1i;
    'u_extrude_scale': Uniform2f;
    'u_device_pixel_ratio': Uniform1f;
    'u_globe_extrude_scale': Uniform1f;
    'u_translate': Uniform2f;
};
declare const circleUniforms: (context: Context, locations: UniformLocations) => CircleUniformsType;
declare const circleUniformValues: (painter: Painter, tile: Tile, layer: CircleStyleLayer, translate: [number, number], radiusCorrectionFactor: number) => UniformValues<CircleUniformsType>;
export { circleUniforms, circleUniformValues };
//# sourceMappingURL=circle_program.d.ts.map