import { StyleLayer } from '../style_layer';
import type { Map } from '../../ui/map';
import { type mat4 } from 'gl-matrix';
import { type LayerSpecification } from '@maplibre/maplibre-gl-style-spec';
import type { ProjectionData } from '../../geo/projection/projection_data';
export type CustomRenderMethodInput = {
    farZ: number;
    nearZ: number;
    fov: number;
    modelViewProjectionMatrix: mat4;
    projectionMatrix: mat4;
    shaderData: {
        variantName: string;
        vertexShaderPrelude: string;
        define: string;
    };
    defaultProjectionData: ProjectionData;
};
export type CustomRenderMethod = (gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput) => void;
export interface CustomLayerInterface {
    id: string;
    type: 'custom';
    renderingMode?: '2d' | '3d';
    render: CustomRenderMethod;
    prerender?: CustomRenderMethod;
    onAdd?(map: Map, gl: WebGLRenderingContext | WebGL2RenderingContext): void;
    onRemove?(map: Map, gl: WebGLRenderingContext | WebGL2RenderingContext): void;
}
export declare function validateCustomStyleLayer(layerObject: CustomLayerInterface): any[];
export declare const isCustomStyleLayer: (layer: StyleLayer) => layer is CustomStyleLayer;
export declare class CustomStyleLayer extends StyleLayer {
    implementation: CustomLayerInterface;
    constructor(implementation: CustomLayerInterface, globalState: Record<string, any>);
    is3D(): boolean;
    hasOffscreenPass(): boolean;
    recalculate(): void;
    updateTransitions(): void;
    hasTransition(): boolean;
    serialize(): LayerSpecification;
    onAdd: (map: Map) => void;
    onRemove: (map: Map) => void;
}
//# sourceMappingURL=custom_style_layer.d.ts.map