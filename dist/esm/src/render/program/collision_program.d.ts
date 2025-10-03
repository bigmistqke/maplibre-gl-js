import { Uniform2f } from '../uniform_binding';
import type { Context } from '../../gl/context';
import type { UniformValues, UniformLocations } from '../uniform_binding';
import type { IReadonlyTransform } from '../../geo/transform_interface';
export type CollisionUniformsType = {
    'u_pixel_extrude_scale': Uniform2f;
};
export type CollisionCircleUniformsType = {
    'u_viewport_size': Uniform2f;
};
declare const collisionUniforms: (context: Context, locations: UniformLocations) => CollisionUniformsType;
declare const collisionCircleUniforms: (context: Context, locations: UniformLocations) => CollisionCircleUniformsType;
declare const collisionUniformValues: (transform: {
    width: number;
    height: number;
}) => UniformValues<CollisionUniformsType>;
declare const collisionCircleUniformValues: (transform: IReadonlyTransform) => UniformValues<CollisionCircleUniformsType>;
export { collisionUniforms, collisionUniformValues, collisionCircleUniforms, collisionCircleUniformValues };
//# sourceMappingURL=collision_program.d.ts.map