import type { Painter } from './painter';
import type { SourceCache } from '../source/source_cache';
import type { OverscaledTileID } from '../source/tile_id';
import { type Style } from '../style/style';
export declare function drawDebugPadding(painter: Painter): void;
export declare function drawDebug(painter: Painter, sourceCache: SourceCache, coords: Array<OverscaledTileID>): void;
export declare function selectDebugSource(style: Style, zoom: number): SourceCache | null;
//# sourceMappingURL=draw_debug.d.ts.map