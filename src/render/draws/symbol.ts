/**
 * Symbol draw function registration
 * Imported by src/style/layers/symbol.ts
 */
import {registerDrawFunction} from '../draw_registry';
import {drawSymbols} from '../draw_symbol';

// Wrapper to adapt drawSymbols signature to match DrawFunction
// Symbol draw needs access to variableOffsets from style.placement
registerDrawFunction('symbol', (painter, sourceCache, layer, coords, renderOptions) => {
    const variableOffsets = painter.style?.placement?.variableOffsets;
    if (variableOffsets) {
        drawSymbols(painter, sourceCache, layer as any, coords, variableOffsets, renderOptions);
    }
});
