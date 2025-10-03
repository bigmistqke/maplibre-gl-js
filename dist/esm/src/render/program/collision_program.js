import { Uniform2f } from '../uniform_binding';
const collisionUniforms = (context, locations) => ({
    'u_pixel_extrude_scale': new Uniform2f(context, locations.u_pixel_extrude_scale)
});
const collisionCircleUniforms = (context, locations) => ({
    'u_viewport_size': new Uniform2f(context, locations.u_viewport_size)
});
const collisionUniformValues = (transform) => {
    return {
        'u_pixel_extrude_scale': [1.0 / transform.width, 1.0 / transform.height],
    };
};
const collisionCircleUniformValues = (transform) => {
    return {
        'u_viewport_size': [transform.width, transform.height]
    };
};
export { collisionUniforms, collisionUniformValues, collisionCircleUniforms, collisionCircleUniformValues };
//# sourceMappingURL=collision_program.js.map