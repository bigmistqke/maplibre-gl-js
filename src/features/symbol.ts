import {SymbolStyleLayer} from '../style/style_layer/symbol_style_layer';
import {drawSymbols} from '../render/draw_symbol';
import {symbolIconUniforms, symbolSDFUniforms, symbolTextAndIconUniforms} from '../render/program/symbol_program';
import {collisionUniforms, collisionCircleUniforms} from '../render/program/collision_program';
import type {Feature, DrawFunction} from '../core/feature';
import {merge} from '../core/feature';

const draw: DrawFunction = (painter, tileManager, layer, coords, renderOptions) => {
    drawSymbols(painter, tileManager, layer as SymbolStyleLayer, coords, painter.style.placement.variableOffsets, renderOptions);
};

const symbolBase: Feature = {
    layers: {
        symbol: {
            StyleLayer: SymbolStyleLayer as any,
            draw,
        }
    },
    programs: {
        symbolIcon: {uniforms: symbolIconUniforms},
        symbolSDF: {uniforms: symbolSDFUniforms},
        symbolTextAndIcon: {uniforms: symbolTextAndIconUniforms},
        collisionBox: {uniforms: collisionUniforms},
        collisionCircle: {uniforms: collisionCircleUniforms},
    },
};

export function labels(...capabilities: Feature[]): Feature {
    return merge(symbolBase, ...capabilities);
}
