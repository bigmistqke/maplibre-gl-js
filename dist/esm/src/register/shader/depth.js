import { registerShader } from '../../shaders/shader_registry';
import { prepare } from '../../shaders/shaders';
import clippingMaskFrag from '../../shaders/clipping_mask.fragment.glsl.g';
import depthVert from '../../shaders/depth.vertex.glsl.g';
registerShader('depth', prepare(clippingMaskFrag, depthVert));
//# sourceMappingURL=depth.js.map