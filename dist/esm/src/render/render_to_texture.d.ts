import { RenderPool } from '../gl/render_pool';
import type { Tile } from '../source/tile';
import type { Painter, RenderOptions } from './painter';
import type { OverscaledTileID } from '../source/tile_id';
import type { Style } from '../style/style';
import type { Terrain } from './terrain';
import type { Texture } from './texture';
import type { StyleLayer } from '../style/style_layer';
export declare class RenderToTexture {
    painter: Painter;
    terrain: Terrain;
    pool: RenderPool;
    _coordsAscending: {
        [_: string]: {
            [_: string]: Array<OverscaledTileID>;
        };
    };
    _coordsAscendingStr: {
        [_: string]: {
            [_: string]: string;
        };
    };
    _stacks: Array<Array<string>>;
    _prevType: string;
    _renderableTiles: Array<Tile>;
    _rttTiles: Array<Tile>;
    _renderableLayerIds: Array<string>;
    constructor(painter: Painter, terrain: Terrain);
    destruct(): void;
    getTexture(tile: Tile): Texture;
    prepareForRender(style: Style, zoom: number): void;
    renderLayer(layer: StyleLayer, renderOptions: RenderOptions): boolean;
}
//# sourceMappingURL=render_to_texture.d.ts.map