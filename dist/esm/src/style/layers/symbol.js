import { registerLayerType } from '../layer_type_registry';
import { SymbolStyleLayer } from '../style_layer/symbol_style_layer';
registerLayerType('symbol', (layer, globalState) => new SymbolStyleLayer(layer, globalState));
import '../../render/draws/symbol';
//# sourceMappingURL=symbol.js.map