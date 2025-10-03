import {registerShader} from '../../shaders/shader_registry';
import {prepare} from '../../shaders/shaders';
import debugFrag from '../../shaders/debug.fragment.glsl.g';
import debugVert from '../../shaders/debug.vertex.glsl.g';

registerShader('debug', prepare(debugFrag, debugVert));
