import {registerShader} from '../../shaders/shader_registry';
import {prepare} from '../../shaders/shaders';
import rasterFrag from '../../shaders/raster.fragment.glsl.g';
import rasterVert from '../../shaders/raster.vertex.glsl.g';
import colorReliefFrag from '../../shaders/color_relief.fragment.glsl.g';
import colorReliefVert from '../../shaders/color_relief.vertex.glsl.g';

registerShader('raster', prepare(rasterFrag, rasterVert));
registerShader('colorRelief', prepare(colorReliefFrag, colorReliefVert));
