import { registerShader } from '../../shaders/shader_registry';
import { prepare } from '../../shaders/shaders';
import circleFrag from '../../shaders/circle.fragment.glsl.g';
import circleVert from '../../shaders/circle.vertex.glsl.g';
registerShader('circle', prepare(circleFrag, circleVert));
//# sourceMappingURL=circle.js.map