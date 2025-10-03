import { registerShader } from '../../shaders/shader_registry';
import { prepare } from '../../shaders/shaders';
import fillFrag from '../../shaders/fill.fragment.glsl.g';
import fillVert from '../../shaders/fill.vertex.glsl.g';
import fillOutlineFrag from '../../shaders/fill_outline.fragment.glsl.g';
import fillOutlineVert from '../../shaders/fill_outline.vertex.glsl.g';
import fillPatternFrag from '../../shaders/fill_pattern.fragment.glsl.g';
import fillPatternVert from '../../shaders/fill_pattern.vertex.glsl.g';
import fillOutlinePatternFrag from '../../shaders/fill_outline_pattern.fragment.glsl.g';
import fillOutlinePatternVert from '../../shaders/fill_outline_pattern.vertex.glsl.g';
registerShader('fill', prepare(fillFrag, fillVert));
registerShader('fillOutline', prepare(fillOutlineFrag, fillOutlineVert));
registerShader('fillPattern', prepare(fillPatternFrag, fillPatternVert));
registerShader('fillOutlinePattern', prepare(fillOutlinePatternFrag, fillOutlinePatternVert));
//# sourceMappingURL=fill.js.map