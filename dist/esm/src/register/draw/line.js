import { registerDrawFunction } from '../../render/draw_registry';
import { drawLine } from '../../render/draw_line';
import { registerShader } from '../../shaders/shader_registry';
import { prepare } from '../../shaders/shaders';
import lineFrag from '../../shaders/line.fragment.glsl.g';
import lineVert from '../../shaders/line.vertex.glsl.g';
import lineGradientFrag from '../../shaders/line_gradient.fragment.glsl.g';
import lineGradientVert from '../../shaders/line_gradient.vertex.glsl.g';
import linePatternFrag from '../../shaders/line_pattern.fragment.glsl.g';
import linePatternVert from '../../shaders/line_pattern.vertex.glsl.g';
import lineSDFFrag from '../../shaders/line_sdf.fragment.glsl.g';
import lineSDFVert from '../../shaders/line_sdf.vertex.glsl.g';
registerDrawFunction('line', drawLine);
registerShader('line', prepare(lineFrag, lineVert));
registerShader('lineGradient', prepare(lineGradientFrag, lineGradientVert));
registerShader('linePattern', prepare(linePatternFrag, linePatternVert));
registerShader('lineSDF', prepare(lineSDFFrag, lineSDFVert));
//# sourceMappingURL=line.js.map