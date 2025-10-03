import { UniformColor, Uniform1i, Uniform1f } from '../uniform_binding';
const debugUniforms = (context, locations) => ({
    'u_color': new UniformColor(context, locations.u_color),
    'u_overlay': new Uniform1i(context, locations.u_overlay),
    'u_overlay_scale': new Uniform1f(context, locations.u_overlay_scale)
});
const debugUniformValues = (color, scaleRatio = 1) => ({
    'u_color': color,
    'u_overlay': 0,
    'u_overlay_scale': scaleRatio
});
export { debugUniforms, debugUniformValues };
//# sourceMappingURL=debug_program.js.map