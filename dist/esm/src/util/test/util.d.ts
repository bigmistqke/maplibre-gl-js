import { Map } from '../../ui/map';
import { type Dispatcher } from '../../util/dispatcher';
import { type IActor } from '../actor';
import { Evented } from '../evented';
import { type SourceSpecification, type StyleSpecification, type TerrainSpecification } from '@maplibre/maplibre-gl-style-spec';
import { type IReadonlyTransform, type ITransform } from '../../geo/transform_interface';
import { type Style } from '../../style/style';
import { type Terrain } from '../../render/terrain';
import { Frustum } from '../primitives/frustum';
export declare class StubMap extends Evented {
    style: Style;
    transform: IReadonlyTransform;
    private _requestManager;
    _terrain: TerrainSpecification;
    constructor();
    _getMapId(): number;
    getPixelRatio(): number;
    setTerrain(terrain: any): void;
    getTerrain(): TerrainSpecification;
    migrateProjection(newTransform: ITransform): void;
}
export declare function createMap(options?: any): Map;
export declare function equalWithPrecision(test: any, expected: any, actual: any, multiplier: any, message: any, extra: any): any;
export declare function setPerformance(): void;
export declare function setMatchMedia(): void;
export declare function beforeMapTest(): void;
export declare function getWrapDispatcher(): (actor: IActor) => Dispatcher;
export declare function getMockDispatcher(): Dispatcher;
export declare function stubAjaxGetImage(createImageBitmap: any): void;
export declare function bufferToArrayBuffer(data: Buffer): ArrayBuffer;
export declare const sleep: (milliseconds?: number) => Promise<void>;
export declare function waitForMetadataEvent(source: Evented): Promise<void>;
export declare function createStyleSource(): SourceSpecification;
export declare function createStyle(): StyleSpecification;
export declare function expectToBeCloseToArray(actual: Array<number>, expected: Array<number>, precision?: number): void;
export declare function createTerrain(): Terrain;
export declare function createFramebuffer(): {
    colorAttachment: {
        get: () => any;
        set: () => void;
    };
    depthAttachment: {
        get: () => any;
        set: () => void;
    };
    destroy: () => void;
};
export declare function waitForEvent(evented: Evented, eventName: string, predicate: (e: any) => boolean): Promise<any>;
export declare function createTestCameraFrustum(fovy: number, aspectRatio: number, zNear: number, zFar: number, elevation: number, rotation: number): Frustum;
//# sourceMappingURL=util.d.ts.map