import type { LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { StyleLayer } from './style_layer';
export type LayerFactory = (layer: LayerSpecification, globalState: Record<string, any>) => StyleLayer;
export declare function registerLayerType(type: string, factory: LayerFactory): void;
export declare function getLayerFactory(type: string): LayerFactory | undefined;
export declare function isLayerTypeRegistered(type: string): boolean;
//# sourceMappingURL=layer_type_registry.d.ts.map