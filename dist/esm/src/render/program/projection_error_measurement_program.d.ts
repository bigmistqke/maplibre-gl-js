import { Uniform1f } from '../uniform_binding';
import type { Context } from '../../gl/context';
import type { UniformValues, UniformLocations } from '../../render/uniform_binding';
export type ProjectionErrorMeasurementUniformsType = {
    'u_input': Uniform1f;
    'u_output_expected': Uniform1f;
};
declare const projectionErrorMeasurementUniforms: (context: Context, locations: UniformLocations) => ProjectionErrorMeasurementUniformsType;
declare const projectionErrorMeasurementUniformValues: (input: number, outputExpected: number) => UniformValues<ProjectionErrorMeasurementUniformsType>;
export { projectionErrorMeasurementUniforms, projectionErrorMeasurementUniformValues };
//# sourceMappingURL=projection_error_measurement_program.d.ts.map