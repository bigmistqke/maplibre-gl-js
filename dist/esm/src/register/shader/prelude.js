import { registerShader } from '../../shaders/shader_registry';
import { prepare } from '../../shaders/shaders';
import preludeFrag from '../../shaders/_prelude.fragment.glsl.g';
import preludeVert from '../../shaders/_prelude.vertex.glsl.g';
registerShader('prelude', prepare(preludeFrag, preludeVert));
//# sourceMappingURL=prelude.js.map