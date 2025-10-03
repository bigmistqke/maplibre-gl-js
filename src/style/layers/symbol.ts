/**
 * Symbol layer type registration
 * Import this module to enable symbol layer support (text labels and icons)
 *
 * Usage:
 *   import 'maplibre-gl/layers/symbol';
 *
 * This will register:
 * - Symbol style layer type
 * - Symbol rendering (draw function)
 * - Symbol bucket creation for workers
 */
import {registerLayerType} from '../layer_type_registry';
import {SymbolStyleLayer} from '../style_layer/symbol_style_layer';

// Register the symbol layer type
registerLayerType('symbol', (layer, globalState) => new SymbolStyleLayer(layer, globalState));

// Register the symbol draw function
import '../../render/draws/symbol';
