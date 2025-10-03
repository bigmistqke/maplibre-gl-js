import { registerLayerType } from '../style/layer_type_registry';
import { SymbolStyleLayer } from '../style/style_layer/symbol_style_layer';
import { registerSymbolDependencies } from '../symbol/symbol_registry';
import { CrossTileSymbolIndex } from '../symbol/cross_tile_symbol_index';
import { PauseablePlacement } from '../style/pauseable_placement';
import { registerDrawFunction } from '../render/draw_registry';
import { drawSymbols } from '../render/draw_symbol';
registerLayerType('symbol', (layer, globalState) => new SymbolStyleLayer(layer, globalState));
registerDrawFunction('symbol', (painter, sourceCache, layer, coords, renderOptions) => {
    var _a, _b;
    const variableOffsets = (_b = (_a = painter.style) === null || _a === void 0 ? void 0 : _a.placement) === null || _b === void 0 ? void 0 : _b.variableOffsets;
    if (variableOffsets) {
        drawSymbols(painter, sourceCache, layer, coords, variableOffsets, renderOptions);
    }
});
registerSymbolDependencies(CrossTileSymbolIndex, PauseablePlacement);
//# sourceMappingURL=symbol.js.map