import {DepthMode} from '../gl/depth_mode';
import {StencilMode} from '../gl/stencil_mode';

import type {Painter, RenderOptions} from './painter';
import type {TileManager} from '../tile/tile_manager';
import type {CustomRenderMethodInput, CustomStyleLayer} from '../style/style_layer/custom_style_layer';

function getCustomLayerArgs(painter: Painter, renderOptions: RenderOptions): CustomRenderMethodInput {
    const {isRenderingGlobe} = renderOptions;
    const projection = painter.style.projection;
    const transform = painter.transform;
    const projectionData = transform.getProjectionDataForCustomLayer(isRenderingGlobe);

    return {
        farZ: transform.farZ,
        nearZ: transform.nearZ,
        fov: transform.fov * Math.PI / 180,
        modelViewProjectionMatrix: transform.modelViewProjectionMatrix,
        projectionMatrix: transform.projectionMatrix,
        shaderData: {
            variantName: projection.shaderVariantName,
            vertexShaderPrelude: `const float PI = 3.141592653589793;\nuniform mat4 u_projection_matrix;\n${projection.shaderPreludeCode.vertexSource}`,
            define: projection.shaderDefine,
        },
        defaultProjectionData: projectionData,
    };
}

export function drawCustomOffscreen(painter: Painter, layer: CustomStyleLayer, renderOptions: RenderOptions) {
    const context = painter.context;
    const implementation = layer.implementation;
    const prerender = implementation.prerender;
    if (!prerender) return;

    const customLayerArgs = getCustomLayerArgs(painter, renderOptions);

    painter.setCustomLayerDefaults();
    context.setColorMode(painter.colorModeForRenderPass());

    prerender.call(implementation, context.gl, customLayerArgs);

    context.setDirty();
    painter.setBaseState();
}

export function drawCustomTranslucent(painter: Painter, _tileManager: TileManager, layer: CustomStyleLayer, renderOptions: RenderOptions) {
    const context = painter.context;
    const implementation = layer.implementation;
    const renderingMode = implementation.renderingMode ? implementation.renderingMode : '2d';
    const customLayerArgs = getCustomLayerArgs(painter, renderOptions);

    painter.setCustomLayerDefaults();

    context.setColorMode(painter.colorModeForRenderPass());
    context.setStencilMode(StencilMode.disabled);

    const depthMode = renderingMode === '3d' ?
        painter.getDepthModeFor3D() :
        painter.getDepthModeForSublayer(0, DepthMode.ReadOnly);

    context.setDepthMode(depthMode);

    implementation.render(context.gl, customLayerArgs);

    context.setDirty();
    painter.setBaseState();
    context.bindFramebuffer.set(null);
}
