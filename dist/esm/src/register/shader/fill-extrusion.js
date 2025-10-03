import { registerShader } from '../../shaders/shader_registry';
import { prepare } from '../../shaders/shaders';
import fillExtrusionFrag from '../../shaders/fill_extrusion.fragment.glsl.g';
import fillExtrusionVert from '../../shaders/fill_extrusion.vertex.glsl.g';
import fillExtrusionPatternFrag from '../../shaders/fill_extrusion_pattern.fragment.glsl.g';
import fillExtrusionPatternVert from '../../shaders/fill_extrusion_pattern.vertex.glsl.g';
registerShader('fillExtrusion', prepare(fillExtrusionFrag, fillExtrusionVert));
registerShader('fillExtrusionPattern', prepare(fillExtrusionPatternFrag, fillExtrusionPatternVert));
//# sourceMappingURL=fill-extrusion.js.map