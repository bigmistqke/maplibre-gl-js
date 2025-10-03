import { Color } from '@maplibre/maplibre-gl-style-spec';
import type { Context } from '../gl/context';
import { type mat4, type vec2, type vec3, type vec4 } from 'gl-matrix';
type $ObjMap<T extends {}, F extends (v: any) => any> = {
    [K in keyof T]: F extends (v: T[K]) => infer R ? R : never;
};
export type UniformValues<Us extends {}> = $ObjMap<Us, <V>(u: Uniform<V>) => V>;
export type UniformLocations = {
    [_: string]: WebGLUniformLocation;
};
declare abstract class Uniform<T> {
    gl: WebGLRenderingContext | WebGL2RenderingContext;
    location: WebGLUniformLocation;
    current: T;
    constructor(context: Context, location: WebGLUniformLocation);
    abstract set(v: T): void;
}
declare class Uniform1i extends Uniform<number> {
    constructor(context: Context, location: WebGLUniformLocation);
    set(v: number): void;
}
declare class Uniform1f extends Uniform<number> {
    constructor(context: Context, location: WebGLUniformLocation);
    set(v: number): void;
}
declare class Uniform2f extends Uniform<vec2> {
    constructor(context: Context, location: WebGLUniformLocation);
    set(v: vec2): void;
}
declare class Uniform3f extends Uniform<vec3> {
    constructor(context: Context, location: WebGLUniformLocation);
    set(v: vec3): void;
}
declare class Uniform4f extends Uniform<vec4> {
    constructor(context: Context, location: WebGLUniformLocation);
    set(v: vec4): void;
}
declare class UniformColor extends Uniform<Color> {
    constructor(context: Context, location: WebGLUniformLocation);
    set(v: Color): void;
}
declare class UniformColorArray extends Uniform<Array<Color>> {
    constructor(context: Context, location: WebGLUniformLocation);
    set(v: Array<Color>): void;
}
declare class UniformFloatArray extends Uniform<Array<number>> {
    constructor(context: Context, location: WebGLUniformLocation);
    set(v: Array<number>): void;
}
declare class UniformMatrix4f extends Uniform<mat4> {
    constructor(context: Context, location: WebGLUniformLocation);
    set(v: mat4): void;
}
export { Uniform, Uniform1i, Uniform1f, Uniform2f, Uniform3f, Uniform4f, UniformColor, UniformColorArray, UniformFloatArray, UniformMatrix4f };
export type UniformBindings = {
    [_: string]: Uniform<any>;
};
//# sourceMappingURL=uniform_binding.d.ts.map