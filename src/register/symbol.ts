/**
 * Symbol layer type registration
 * Import this module to enable symbol layer support (text labels and icons)
 *
 * Usage:
 *   import 'maplibre-gl/symbol';
 *
 * This will register:
 * - Symbol style layer type
 * - Symbol rendering (draw function)
 * - Symbol bucket creation for workers
 * - Symbol placement system (CrossTileSymbolIndex, PauseablePlacement)
 */
import {registerLayerType} from '../style/layer_type_registry';
import {SymbolStyleLayer} from '../style/style_layer/symbol_style_layer';
import {registerSymbolDependencies} from '../symbol/symbol_registry';
import {CrossTileSymbolIndex} from '../symbol/cross_tile_symbol_index';
import {PauseablePlacement} from '../style/pauseable_placement';
import {registerDrawFunction} from '../render/draw_registry';
import {drawSymbols} from '../render/draw_symbol';

// Register the symbol layer type
registerLayerType('symbol', (layer, globalState) => new SymbolStyleLayer(layer, globalState));

// Register the symbol draw function
// Wrapper to adapt drawSymbols signature to match DrawFunction
// Symbol draw needs access to variableOffsets from style.placement
registerDrawFunction('symbol', (painter, sourceCache, layer, coords, renderOptions) => {
    const variableOffsets = painter.style?.placement?.variableOffsets;
    if (variableOffsets) {
        drawSymbols(painter, sourceCache, layer as any, coords, variableOffsets, renderOptions);
    }
});

// Register symbol system dependencies for lazy initialization
registerSymbolDependencies(CrossTileSymbolIndex, PauseablePlacement);
