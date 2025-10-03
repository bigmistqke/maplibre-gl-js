import {registerShader} from '../../shaders/shader_registry';
import {prepare} from '../../shaders/shaders';
import atmosphereFrag from '../../shaders/atmosphere.fragment.glsl.g';
import atmosphereVert from '../../shaders/atmosphere.vertex.glsl.g';

registerShader('atmosphere', prepare(atmosphereFrag, atmosphereVert));
