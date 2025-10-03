import { registerShader } from '../../shaders/shader_registry';
import { prepare } from '../../shaders/shaders';
import backgroundFrag from '../../shaders/background.fragment.glsl.g';
import backgroundVert from '../../shaders/background.vertex.glsl.g';
import backgroundPatternFrag from '../../shaders/background_pattern.fragment.glsl.g';
import backgroundPatternVert from '../../shaders/background_pattern.vertex.glsl.g';
registerShader('background', prepare(backgroundFrag, backgroundVert));
registerShader('backgroundPattern', prepare(backgroundPatternFrag, backgroundPatternVert));
//# sourceMappingURL=background.js.map