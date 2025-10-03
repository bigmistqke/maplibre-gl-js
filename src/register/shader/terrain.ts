import {registerShader} from '../../shaders/shader_registry';
import {prepare} from '../../shaders/shaders';
import terrainFrag from '../../shaders/terrain.fragment.glsl.g';
import terrainVert from '../../shaders/terrain.vertex.glsl.g';
import terrainDepthFrag from '../../shaders/terrain_depth.fragment.glsl.g';
import terrainVertDepth from '../../shaders/terrain_depth.vertex.glsl.g';
import terrainCoordsFrag from '../../shaders/terrain_coords.fragment.glsl.g';
import terrainVertCoords from '../../shaders/terrain_coords.vertex.glsl.g';

registerShader('terrain', prepare(terrainFrag, terrainVert));
registerShader('terrainDepth', prepare(terrainDepthFrag, terrainVertDepth));
registerShader('terrainCoords', prepare(terrainCoordsFrag, terrainVertCoords));
