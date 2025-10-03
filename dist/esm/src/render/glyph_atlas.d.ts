import { AlphaImage } from '../util/image';
import type { GlyphMetrics } from '../style/style_glyph';
import type { GetGlyphsResponse } from '../util/actor_messages';
export type Rect = {
    x: number;
    y: number;
    w: number;
    h: number;
};
export type GlyphPosition = {
    rect: Rect;
    metrics: GlyphMetrics;
};
export type GlyphPositions = {
    [_: string]: {
        [_: number]: GlyphPosition;
    };
};
export declare class GlyphAtlas {
    image: AlphaImage;
    positions: GlyphPositions;
    constructor(stacks: GetGlyphsResponse);
}
//# sourceMappingURL=glyph_atlas.d.ts.map