import {registerShader} from '../../shaders/shader_registry';
import {prepare} from '../../shaders/shaders';
import collisionBoxFrag from '../../shaders/collision_box.fragment.glsl.g';
import collisionBoxVert from '../../shaders/collision_box.vertex.glsl.g';
import collisionCircleFrag from '../../shaders/collision_circle.fragment.glsl.g';
import collisionCircleVert from '../../shaders/collision_circle.vertex.glsl.g';

registerShader('collisionBox', prepare(collisionBoxFrag, collisionBoxVert));
registerShader('collisionCircle', prepare(collisionCircleFrag, collisionCircleVert));
