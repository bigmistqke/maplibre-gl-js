import {registerShader} from '../../shaders/shader_registry';
import {prepare} from '../../shaders/shaders';
import projectionErrorMeasurementFrag from '../../shaders/projection_error_measurement.fragment.glsl.g';
import projectionErrorMeasurementVert from '../../shaders/projection_error_measurement.vertex.glsl.g';

registerShader('projectionErrorMeasurement', prepare(projectionErrorMeasurementFrag, projectionErrorMeasurementVert));
