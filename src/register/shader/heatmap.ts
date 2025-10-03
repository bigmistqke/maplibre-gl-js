import {registerShader} from '../../shaders/shader_registry';
import {prepare} from '../../shaders/shaders';
import heatmapFrag from '../../shaders/heatmap.fragment.glsl.g';
import heatmapVert from '../../shaders/heatmap.vertex.glsl.g';
import heatmapTextureFrag from '../../shaders/heatmap_texture.fragment.glsl.g';
import heatmapTextureVert from '../../shaders/heatmap_texture.vertex.glsl.g';

registerShader('heatmap', prepare(heatmapFrag, heatmapVert));
registerShader('heatmapTexture', prepare(heatmapTextureFrag, heatmapTextureVert));
