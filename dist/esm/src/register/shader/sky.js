import { registerShader } from '../../shaders/shader_registry';
import { prepare } from '../../shaders/shaders';
import skyFrag from '../../shaders/sky.fragment.glsl.g';
import skyVert from '../../shaders/sky.vertex.glsl.g';
registerShader('sky', prepare(skyFrag, skyVert));
//# sourceMappingURL=sky.js.map