import { getFromHarvestRegistry } from "../../registry";
import {warnOnce} from '../../util/util';
import type {MercatorProjection} from './mercator_projection';
import type {MercatorTransform} from './mercator_transform';
import type {MercatorCameraHelper} from './mercator_camera_helper';
import type {GlobeProjection} from './globe_projection';
import type {GlobeTransform} from './globe_transform';
import type {GlobeCameraHelper} from './globe_camera_helper';
import type {VerticalPerspectiveCameraHelper} from './vertical_perspective_camera_helper';
import type {VerticalPerspectiveTransform} from './vertical_perspective_transform';
import type {VerticalPerspectiveProjection} from './vertical_perspective_projection';

import type {ProjectionSpecification} from '@maplibre/maplibre-gl-style-spec';
import type {Projection} from './projection';
import type {ITransform, TransformConstrainFunction} from '../transform_interface';
import type {ICameraHelper} from './camera_helper';

export function createProjectionFromName(name: ProjectionSpecification['type'], transformConstrain?: TransformConstrainFunction): {
    projection: Projection;
    transform: ITransform;
    cameraHelper: ICameraHelper;
} {
    const transformOptions = {constrainOverride: transformConstrain};
    if (Array.isArray(name)) {
        const globeProjection = new (getFromHarvestRegistry('./geo/projection/globe_projection#GlobeProjection'))({type: name});
        return {
            projection: globeProjection,
            transform: new (getFromHarvestRegistry('./geo/projection/globe_transform#GlobeTransform'))(transformOptions),
            cameraHelper: new (getFromHarvestRegistry('./geo/projection/globe_camera_helper#GlobeCameraHelper'))(globeProjection),
        };
    }
    switch (name) {
        case 'mercator':
        {
            return {
                projection: new (getFromHarvestRegistry('./geo/projection/mercator_projection#MercatorProjection'))(),
                transform: new (getFromHarvestRegistry('./geo/projection/mercator_transform#MercatorTransform'))(transformOptions),
                cameraHelper: new (getFromHarvestRegistry('./geo/projection/mercator_camera_helper#MercatorCameraHelper'))(),
            };
        }
        case 'globe':
        {
            const globeProjection = new (getFromHarvestRegistry('./geo/projection/globe_projection#GlobeProjection'))({type: [
                            'interpolate',
                            ['linear'],
                            ['zoom'],
                            11,
                            'vertical-perspective',
                            12,
                            'mercator'
                        ]});
            return {
                projection: globeProjection,
                transform: new (getFromHarvestRegistry('./geo/projection/globe_transform#GlobeTransform'))(transformOptions),
                cameraHelper: new (getFromHarvestRegistry('./geo/projection/globe_camera_helper#GlobeCameraHelper'))(globeProjection),
            };
        }
        case 'vertical-perspective':
        {
            return {
                projection: new (getFromHarvestRegistry('./geo/projection/vertical_perspective_projection#VerticalPerspectiveProjection'))(),
                transform: new (getFromHarvestRegistry('./geo/projection/vertical_perspective_transform#VerticalPerspectiveTransform'))(transformOptions),
                cameraHelper: new (getFromHarvestRegistry('./geo/projection/vertical_perspective_camera_helper#VerticalPerspectiveCameraHelper'))(),
            };
        }
        default:
        {
            warnOnce(`Unknown projection name: ${name}. Falling back to mercator projection.`);
            return {
                projection: new (getFromHarvestRegistry('./geo/projection/mercator_projection#MercatorProjection'))(),
                transform: new (getFromHarvestRegistry('./geo/projection/mercator_transform#MercatorTransform'))(transformOptions),
                cameraHelper: new (getFromHarvestRegistry('./geo/projection/mercator_camera_helper#MercatorCameraHelper'))(),
            };
        }
    }
}
