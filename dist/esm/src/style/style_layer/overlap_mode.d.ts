import { type SymbolLayoutPropsPossiblyEvaluated } from './symbol_style_layer_properties.g';
import type { SymbolLayoutProps } from './symbol_style_layer_properties.g';
import { type PossiblyEvaluated } from '../properties';
export type OverlapMode = 'never' | 'always' | 'cooperative';
export declare function getOverlapMode(layout: PossiblyEvaluated<SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated>, overlapProp: 'icon-overlap', allowOverlapProp: 'icon-allow-overlap'): OverlapMode;
export declare function getOverlapMode(layout: PossiblyEvaluated<SymbolLayoutProps, SymbolLayoutPropsPossiblyEvaluated>, overlapProp: 'text-overlap', allowOverlapProp: 'text-allow-overlap'): OverlapMode;
//# sourceMappingURL=overlap_mode.d.ts.map