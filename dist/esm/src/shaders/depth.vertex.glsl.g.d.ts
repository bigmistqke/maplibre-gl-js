declare const _default: "in vec2 a_pos;void main() {\n#ifdef GLOBE\ngl_Position=projectTileFor3D(a_pos,0.0);\n#else\ngl_Position=u_projection_matrix*vec4(a_pos,0.0,1.0);\n#endif\n}";
export default _default;
//# sourceMappingURL=depth.vertex.glsl.g.d.ts.map