import { registerShader } from '../../shaders/shader_registry';
import { prepare } from '../../shaders/shaders';
import clippingMaskFrag from '../../shaders/clipping_mask.fragment.glsl.g';
import clippingMaskVert from '../../shaders/clipping_mask.vertex.glsl.g';
registerShader('clippingMask', prepare(clippingMaskFrag, clippingMaskVert));
//# sourceMappingURL=clipping-mask.js.map