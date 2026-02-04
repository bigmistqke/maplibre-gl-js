import Benchmark from '../lib/benchmark';
import createMap from '../lib/create_map';
import {CustomLayerInterface, CustomRenderMethodInput} from '../../../src/style/style_layer/custom_style_layer';
import {Map} from '../../../src/ui/map';

class Tent3D implements CustomLayerInterface {
    id: string = 'tent-3d';
    type: 'custom' = 'custom';
    renderingMode: '3d' = '3d';
    program!: WebGLProgram & {
        a_pos?: number;
        aPos?: number;
        uMatrix?: WebGLUniformLocation;
    };
    vertexBuffer!: WebGLBuffer;
    indexBuffer!: WebGLBuffer;
    constructor() {
    }

    onAdd(map: Map, gl: WebGL2RenderingContext) {
        const vertexSource = `#version 300 es

        in vec3 aPos;
        uniform mat4 uMatrix;

        void main() {
            gl_Position = uMatrix * vec4(aPos, 1.0);
        }
        `;

        const fragmentSource = `#version 300 es

        out highp vec4 fragColor;
        void main() {
            fragColor = vec4(1.0, 0.0, 0.0, 1.0);
        }`;

        const vertexShader = gl.createShader(gl.VERTEX_SHADER);
        if (!vertexShader) throw new Error('Failed to create vertex shader');
        gl.shaderSource(vertexShader, vertexSource);
        gl.compileShader(vertexShader);
        const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
        if (!fragmentShader) throw new Error('Failed to create fragment shader');
        gl.shaderSource(fragmentShader, fragmentSource);
        gl.compileShader(fragmentShader);

        this.program = gl.createProgram();
        if (!this.program) throw new Error('Failed to create program');
        gl.attachShader(this.program, vertexShader);
        gl.attachShader(this.program, fragmentShader);
        gl.linkProgram(this.program);
        gl.validateProgram(this.program);

        this.program.aPos = gl.getAttribLocation(this.program, 'aPos');
        this.program.uMatrix = gl.getUniformLocation(this.program, 'uMatrix') || undefined;

        const x = 0.5 - 0.015;
        const y = 0.5 - 0.01;
        const z = 0.01;
        const d = 0.01;

        const vertexArray = new Float32Array([
            x,
            y,
            0,
            x + d,
            y,
            0,
            x,
            y + d,
            z,
            x + d,
            y + d,
            z,
            x,
            y + d + d,
            0,
            x + d,
            y + d + d,
            0,
        ]);
        const indexArray = new Uint16Array([
            0, 1, 2, 1, 2, 3, 2, 3, 4, 3, 4, 5,
        ]);

        this.vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, this.vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW);
        this.indexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexArray, gl.STATIC_DRAW);
    }

    render(gl: WebGLRenderingContext | WebGL2RenderingContext, options: CustomRenderMethodInput): void {
        const glContext = gl as WebGL2RenderingContext;
        glContext.useProgram(this.program);
        glContext.bindBuffer(glContext.ARRAY_BUFFER, this.vertexBuffer);
        glContext.bindBuffer(glContext.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
        if (this.program.a_pos !== undefined) {
            glContext.enableVertexAttribArray(this.program.a_pos);
        }
        if (this.program.aPos !== undefined) {
            glContext.vertexAttribPointer(this.program.aPos, 3, glContext.FLOAT, false, 0, 0);
        }
        if (this.program.uMatrix !== undefined) {
            glContext.uniformMatrix4fv(this.program.uMatrix, false, options.modelViewProjectionMatrix);
        }
        glContext.drawElements(glContext.TRIANGLES, 12, glContext.UNSIGNED_SHORT, 0);
    }
}

export default class CustomLayer extends Benchmark {
    map!: Map;
    setup(): Promise<void> {
        return new Promise((resolve, reject) => {
            createMap({
                width: 1024,
                height: 1024,
                style: {
                    version: 8,
                    sources: {},
                    layers: [],
                },
                center: [-9.4, -26.8],
                pitch: 60,
                bearing: 131,
                zoom: 1.69,
            })
                .then((map) => {
                    this.map = map;
                    resolve();
                })
                .catch((error) => {
                    console.error(error);
                    reject(error);
                });
        });
    }

    bench() {
        const customLayer = new Tent3D();
        this.map.addLayer(customLayer as any);
        this.map._styleDirty = true;
        this.map._sourcesDirty = true;
        this.map._render(Date.now());
    }
    teardown() {
        this.map.remove();
    }
}
