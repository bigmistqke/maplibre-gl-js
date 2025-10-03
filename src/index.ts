/**
 * Full MapLibre bundle with all default handlers and layer types registered.
 * For tree-shaking, use 'maplibre-gl/core' and import specific handlers/layers.
 */

// Register all core layer types
import './style/layers';

// Register all core draw functions
import './render/draws';

// Register symbol layer (for backward compatibility)
import './style/layers/symbol';

// Register all default handlers for full bundle
import './ui/handlers';

// Re-export everything from core
export * from './core';
