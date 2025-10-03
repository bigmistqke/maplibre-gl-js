import type { Map } from '../map';
import type { PointLike } from '../camera';
import type { IReadonlyTransform } from '../../geo/transform_interface';
import { type LngLat } from '../../geo/lng_lat';
export declare class TransformProvider {
    _map: Map;
    constructor(map: Map);
    get transform(): IReadonlyTransform;
    get center(): {
        lng: number;
        lat: number;
    };
    get zoom(): number;
    get pitch(): number;
    get bearing(): number;
    unproject(point: PointLike): LngLat;
}
//# sourceMappingURL=transform-provider.d.ts.map