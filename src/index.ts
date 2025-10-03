/**
 * Full MapLibre bundle with all default handlers and layer types registered.
 * For tree-shaking, use 'maplibre-gl/core' and import specific handlers/layers.
 */


// Register all core layers, draws, handlers, and symbols
// These must be imported first to prevent race conditions
import './register/layers';
import './register/draws';
import './register/symbol';
import './register/handlers';

// Re-export everything from core
export * from './core';
