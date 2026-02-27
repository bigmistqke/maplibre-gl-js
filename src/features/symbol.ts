import {SymbolStyleLayer} from '../style/style_layer/symbol_style_layer';
import {SymbolBucket} from '../data/bucket/symbol_bucket';
import {drawSymbols} from '../render/draw_symbol';
import {symbolIconUniforms, symbolSDFUniforms, symbolTextAndIconUniforms} from '../render/program/symbol_program';
import {collisionUniforms, collisionCircleUniforms} from '../render/program/collision_program';
import {prepare} from '../shaders/shaders';
import symbolIconFrag from '../shaders/symbol_icon.fragment.glsl.g';
import symbolIconVert from '../shaders/symbol_icon.vertex.glsl.g';
import symbolSDFFrag from '../shaders/symbol_sdf.fragment.glsl.g';
import symbolSDFVert from '../shaders/symbol_sdf.vertex.glsl.g';
import symbolTextAndIconFrag from '../shaders/symbol_text_and_icon.fragment.glsl.g';
import symbolTextAndIconVert from '../shaders/symbol_text_and_icon.vertex.glsl.g';
import collisionBoxFrag from '../shaders/collision_box.fragment.glsl.g';
import collisionBoxVert from '../shaders/collision_box.vertex.glsl.g';
import collisionCircleFrag from '../shaders/collision_circle.fragment.glsl.g';
import collisionCircleVert from '../shaders/collision_circle.vertex.glsl.g';
import type {Feature, DrawFunction} from '../core/feature';
import {merge, ImageManager, GlyphManager, CrossTileSymbolIndex} from '../core/feature';

const draw: DrawFunction = (painter, tileManager, layer, coords, renderOptions) => {
    drawSymbols(painter, tileManager, layer as SymbolStyleLayer, coords, painter.style.placement.variableOffsets, renderOptions);
};

const symbolBase: Feature = {
    layers: {
        symbol: {
            StyleLayer: SymbolStyleLayer as any,
            Bucket: SymbolBucket,
            draw,
        }
    },
    programs: {
        symbolIcon: {uniforms: symbolIconUniforms, shaderSource: prepare(symbolIconFrag, symbolIconVert)},
        symbolSDF: {uniforms: symbolSDFUniforms, shaderSource: prepare(symbolSDFFrag, symbolSDFVert)},
        symbolTextAndIcon: {uniforms: symbolTextAndIconUniforms, shaderSource: prepare(symbolTextAndIconFrag, symbolTextAndIconVert)},
        collisionBox: {uniforms: collisionUniforms, shaderSource: prepare(collisionBoxFrag, collisionBoxVert)},
        collisionCircle: {uniforms: collisionCircleUniforms, shaderSource: prepare(collisionCircleFrag, collisionCircleVert)},
    },
    singletons: {ImageManager, GlyphManager, CrossTileSymbolIndex},
};

export function labels(...capabilities: Feature[]): Feature {
    return merge(symbolBase, ...capabilities);
}
