import type { ProjectionSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { Projection } from './projection';
import type { ITransform } from '../transform_interface';
import type { ICameraHelper } from './camera_helper';
export declare function createProjectionFromName(name: ProjectionSpecification['type']): {
    projection: Projection;
    transform: ITransform;
    cameraHelper: ICameraHelper;
};
//# sourceMappingURL=projection_factory.d.ts.map