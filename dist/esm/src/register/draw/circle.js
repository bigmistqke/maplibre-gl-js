import { registerDrawFunction } from '../../render/draw_registry';
import { drawCircles } from '../../render/draw_circle';
import { registerShader } from '../../shaders/shader_registry';
import { prepare } from '../../shaders/shaders';
import circleFrag from '../../shaders/circle.fragment.glsl.g';
import circleVert from '../../shaders/circle.vertex.glsl.g';
registerDrawFunction('circle', drawCircles);
registerShader('circle', prepare(circleFrag, circleVert));
//# sourceMappingURL=circle.js.map