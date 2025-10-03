import { Uniform1f } from '../uniform_binding';
const projectionErrorMeasurementUniforms = (context, locations) => ({
    'u_input': new Uniform1f(context, locations.u_input),
    'u_output_expected': new Uniform1f(context, locations.u_output_expected),
});
const projectionErrorMeasurementUniformValues = (input, outputExpected) => ({
    'u_input': input,
    'u_output_expected': outputExpected,
});
export { projectionErrorMeasurementUniforms, projectionErrorMeasurementUniformValues };
//# sourceMappingURL=projection_error_measurement_program.js.map