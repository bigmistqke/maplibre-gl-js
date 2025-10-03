import {registerDrawFunction} from '../../render/draw_registry';
import {drawLine} from '../../render/draw_line';

registerDrawFunction('line', drawLine);
