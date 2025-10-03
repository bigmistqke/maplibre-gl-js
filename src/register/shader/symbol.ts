import {registerShader} from '../../shaders/shader_registry';
import {prepare} from '../../shaders/shaders';
import symbolIconFrag from '../../shaders/symbol_icon.fragment.glsl.g';
import symbolIconVert from '../../shaders/symbol_icon.vertex.glsl.g';
import symbolSDFFrag from '../../shaders/symbol_sdf.fragment.glsl.g';
import symbolSDFVert from '../../shaders/symbol_sdf.vertex.glsl.g';
import symbolTextAndIconFrag from '../../shaders/symbol_text_and_icon.fragment.glsl.g';
import symbolTextAndIconVert from '../../shaders/symbol_text_and_icon.vertex.glsl.g';

registerShader('symbolIcon', prepare(symbolIconFrag, symbolIconVert));
registerShader('symbolSDF', prepare(symbolSDFFrag, symbolSDFVert));
registerShader('symbolTextAndIcon', prepare(symbolTextAndIconFrag, symbolTextAndIconVert));
