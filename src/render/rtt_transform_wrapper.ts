import type {mat4} from 'gl-matrix';
import type {IReadonlyTransform} from '../geo/transform_interface';
import type {ProjectionDataParams} from '../geo/projection/projection_data';

/**
 * Creates a transform wrapper for RTT rendering.
 * Intercepts `getProjectionData` to:
 * - Force `projectionTransition: 0` (always mercator during RTT)
 * - Substitute RTT position matrices for tile rendering
 * All other transform properties/methods are delegated unchanged.
 */
export function createRttTransformWrapper(
    transform: IReadonlyTransform,
    rttPosMatrices: Record<string, mat4>,
): IReadonlyTransform {
    return new Proxy(transform, {
        get(target, prop, receiver) {
            if (prop === 'getProjectionData') {
                return (params: ProjectionDataParams) => {
                    const data = target.getProjectionData(params);
                    const rttMatrix = params.overscaledTileID
                        ? rttPosMatrices[params.overscaledTileID.key]
                        : undefined;
                    if (rttMatrix) {
                        data.mainMatrix = rttMatrix;
                        data.fallbackMatrix = rttMatrix;
                    }
                    data.projectionTransition = 0;
                    return data;
                };
            }
            return Reflect.get(target, prop, receiver);
        }
    });
}
