import { registerLayerType } from '../layer_type_registry';
import { SymbolStyleLayer } from '../style_layer/symbol_style_layer';
import { registerSymbolDependencies } from '../../symbol/symbol_registry';
import { CrossTileSymbolIndex } from '../../symbol/cross_tile_symbol_index';
import { PauseablePlacement } from '../pauseable_placement';
registerLayerType('symbol', (layer, globalState) => new SymbolStyleLayer(layer, globalState));
import '../../render/draws/symbol';
registerSymbolDependencies(CrossTileSymbolIndex, PauseablePlacement);
//# sourceMappingURL=symbol.js.map