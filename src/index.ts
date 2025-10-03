/**
 * Full MapLibre bundle with all default handlers and layer types registered.
 * For tree-shaking, use 'maplibre-gl/core' and import specific handlers/layers.
 */

// Register all core layers, draws, handlers, and symbols
// These must be imported first to prevent race conditions
import './register/layer/background';
import './register/layer/circle';
import './register/layer/fill';
import './register/layer/fill-extrusion';
import './register/layer/heatmap';
import './register/layer/hillshade';
import './register/layer/color-relief';
import './register/layer/line';
import './register/layer/raster';
import './register/draw/background';
import './register/draw/circle';
import './register/draw/fill';
import './register/draw/fill-extrusion';
import './register/draw/heatmap';
import './register/draw/hillshade';
import './register/draw/line';
import './register/draw/raster';
import './register/symbol';
// Shaders
import './register/shader/background';
import './register/shader/circle';
import './register/shader/fill';
import './register/shader/fill-extrusion';
import './register/shader/heatmap';
import './register/shader/hillshade';
import './register/shader/line';
import './register/shader/raster';
import './register/shader/symbol';
// Low-level handlers (dependencies for composite handlers)
import './register/handlers/mouse-rotate';
import './register/handlers/mouse-pitch';
import './register/handlers/mouse-roll';
import './register/handlers/mouse-pan';
import './register/handlers/touch-pan';
import './register/handlers/click-zoom';
import './register/handlers/tap-zoom';
import './register/handlers/touch-rotate';
import './register/handlers/touch-zoom';
// Composite handlers
import './register/handlers/box-zoom';
import './register/handlers/cooperative-gestures';
import './register/handlers/double-click-zoom';
import './register/handlers/tap-drag-zoom';
import './register/handlers/touch-pitch';
import './register/handlers/drag-rotate';
import './register/handlers/drag-pan';
import './register/handlers/touch-zoom-rotate';
import './register/handlers/scroll-zoom';
import './register/handlers/keyboard';

// Re-export everything from core
export * from './core';
