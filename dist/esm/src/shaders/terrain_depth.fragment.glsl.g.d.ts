declare const _default: "in float v_depth;const highp vec4 bitSh=vec4(256.*256.*256.,256.*256.,256.,1.);const highp vec4 bitMsk=vec4(0.,vec3(1./256.0));highp vec4 pack(highp float value) {highp vec4 comp=fract(value*bitSh);comp-=comp.xxyz*bitMsk;return comp;}void main() {fragColor=pack(v_depth);}";
export default _default;
//# sourceMappingURL=terrain_depth.fragment.glsl.g.d.ts.map