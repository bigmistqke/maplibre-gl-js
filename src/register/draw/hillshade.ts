import {registerDrawFunction} from '../../render/draw_registry';
import {drawHillshade} from '../../render/draw_hillshade';

registerDrawFunction('hillshade', drawHillshade);
