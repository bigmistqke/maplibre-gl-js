import {registerDrawFunction} from '../../render/draw_registry';
import {drawFill} from '../../render/draw_fill';

registerDrawFunction('fill', drawFill);
