import type { CrossFaded } from '../style/properties';
import type { ResolvedImage } from '@maplibre/maplibre-gl-style-spec';
import type { Tile } from '../source/tile';
import type { ProgramConfiguration } from '../data/program_configuration';
import type { FillExtrusionStyleLayer } from '../style/style_layer/fill_extrusion_style_layer';
import type { FillStyleLayer } from '../style/style_layer/fill_style_layer';
export declare function updatePatternPositionsInProgram(programConfiguration: ProgramConfiguration, propertyName: 'fill-pattern' | 'fill-extrusion-pattern', constantPattern: CrossFaded<ResolvedImage>, tile: Tile, layer: FillStyleLayer | FillExtrusionStyleLayer): void;
//# sourceMappingURL=update_pattern_positions_in_program.d.ts.map