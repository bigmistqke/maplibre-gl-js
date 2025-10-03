import { registerDrawFunction } from '../draw_registry';
import { drawSymbols } from '../draw_symbol';
registerDrawFunction('symbol', (painter, sourceCache, layer, coords, renderOptions) => {
    var _a, _b;
    const variableOffsets = (_b = (_a = painter.style) === null || _a === void 0 ? void 0 : _a.placement) === null || _b === void 0 ? void 0 : _b.variableOffsets;
    if (variableOffsets) {
        drawSymbols(painter, sourceCache, layer, coords, variableOffsets, renderOptions);
    }
});
//# sourceMappingURL=symbol.js.map