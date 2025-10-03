import { registerShader } from '../../shaders/shader_registry';
import { prepare } from '../../shaders/shaders';
import projectionMercatorVert from '../../shaders/_projection_mercator.vertex.glsl.g';
import projectionGlobeVert from '../../shaders/_projection_globe.vertex.glsl.g';
registerShader('projectionMercator', prepare('', projectionMercatorVert));
registerShader('projectionGlobe', prepare('', projectionGlobeVert));
//# sourceMappingURL=projection.js.map