import { registerDrawFunction } from '../../render/draw_registry';
import { drawHillshade } from '../../render/draw_hillshade';
import { registerShader } from '../../shaders/shader_registry';
import { prepare } from '../../shaders/shaders';
import hillshadeFrag from '../../shaders/hillshade.fragment.glsl.g';
import hillshadeVert from '../../shaders/hillshade.vertex.glsl.g';
import hillshadePrepareFrag from '../../shaders/hillshade_prepare.fragment.glsl.g';
import hillshadePrepareVert from '../../shaders/hillshade_prepare.vertex.glsl.g';
registerDrawFunction('hillshade', drawHillshade);
registerShader('hillshade', prepare(hillshadeFrag, hillshadeVert));
registerShader('hillshadePrepare', prepare(hillshadePrepareFrag, hillshadePrepareVert));
//# sourceMappingURL=hillshade.js.map