/**
 * Full MapLibre bundle with all default handlers registered.
 * For tree-shaking, use 'maplibre-gl/core' and import specific handlers.
 */

// Register all default handlers for full bundle
import './ui/handlers';

// Re-export everything from core
export * from './core';
