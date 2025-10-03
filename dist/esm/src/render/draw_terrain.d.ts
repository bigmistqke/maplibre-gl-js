import type { Painter, RenderOptions } from './painter';
import type { Tile } from '../source/tile';
import { type Terrain } from './terrain';
declare function drawDepth(painter: Painter, terrain: Terrain): void;
declare function drawCoords(painter: Painter, terrain: Terrain): void;
declare function drawTerrain(painter: Painter, terrain: Terrain, tiles: Array<Tile>, renderOptions: RenderOptions): void;
export { drawTerrain, drawDepth, drawCoords };
//# sourceMappingURL=draw_terrain.d.ts.map