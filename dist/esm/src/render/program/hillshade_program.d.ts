import { Uniform1i, Uniform1f, Uniform2f, UniformColor, UniformFloatArray, UniformColorArray, UniformMatrix4f, Uniform4f } from '../uniform_binding';
import type { Context } from '../../gl/context';
import type { UniformValues, UniformLocations } from '../uniform_binding';
import type { Tile } from '../../source/tile';
import type { Painter } from '../painter';
import type { HillshadeStyleLayer } from '../../style/style_layer/hillshade_style_layer';
import type { DEMData } from '../../data/dem_data';
import type { OverscaledTileID } from '../../source/tile_id';
export type HillshadeUniformsType = {
    'u_image': Uniform1i;
    'u_latrange': Uniform2f;
    'u_exaggeration': Uniform1f;
    'u_altitudes': UniformFloatArray;
    'u_azimuths': UniformFloatArray;
    'u_accent': UniformColor;
    'u_method': Uniform1i;
    'u_shadows': UniformColorArray;
    'u_highlights': UniformColorArray;
};
export type HillshadePrepareUniformsType = {
    'u_matrix': UniformMatrix4f;
    'u_image': Uniform1i;
    'u_dimension': Uniform2f;
    'u_zoom': Uniform1f;
    'u_unpack': Uniform4f;
};
declare const hillshadeUniforms: (context: Context, locations: UniformLocations) => HillshadeUniformsType;
declare const hillshadePrepareUniforms: (context: Context, locations: UniformLocations) => HillshadePrepareUniformsType;
declare const hillshadeUniformValues: (painter: Painter, tile: Tile, layer: HillshadeStyleLayer) => UniformValues<HillshadeUniformsType>;
declare const hillshadeUniformPrepareValues: (tileID: OverscaledTileID, dem: DEMData) => UniformValues<HillshadePrepareUniformsType>;
export { hillshadeUniforms, hillshadePrepareUniforms, hillshadeUniformValues, hillshadeUniformPrepareValues };
//# sourceMappingURL=hillshade_program.d.ts.map