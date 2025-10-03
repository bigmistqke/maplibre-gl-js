import Point from '@mapbox/point-geometry';
import type { Anchor } from './anchor';
import type { PositionedIcon, Shaping } from './shaping';
import type { SymbolStyleLayer } from '../style/style_layer/symbol_style_layer';
import type { Feature } from '@maplibre/maplibre-gl-style-spec';
import type { StyleImage } from '../style/style_image';
export type SymbolQuad = {
    tl: Point;
    tr: Point;
    bl: Point;
    br: Point;
    tex: {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    pixelOffsetTL: Point;
    pixelOffsetBR: Point;
    writingMode: any | void;
    glyphOffset: [number, number];
    sectionIndex: number;
    isSDF: boolean;
    minFontScaleX: number;
    minFontScaleY: number;
};
export declare function getIconQuads(shapedIcon: PositionedIcon, iconRotate: number, isSDFIcon: boolean, hasIconTextFit: boolean): Array<SymbolQuad>;
export declare function getGlyphQuads(anchor: Anchor, shaping: Shaping, textOffset: [number, number], layer: SymbolStyleLayer, alongLine: boolean, feature: Feature, imageMap: {
    [_: string]: StyleImage;
}, allowVerticalPlacement: boolean): Array<SymbolQuad>;
//# sourceMappingURL=quads.d.ts.map