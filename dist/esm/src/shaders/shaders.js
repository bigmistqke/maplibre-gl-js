export function prepare(fragmentSource, vertexSource) {
    const re = /#pragma mapbox: ([\w]+) ([\w]+) ([\w]+) ([\w]+)/g;
    const vertexAttributes = vertexSource.match(/in ([\w]+) ([\w]+)/g);
    const fragmentUniforms = fragmentSource.match(/uniform ([\w]+) ([\w]+)([\s]*)([\w]*)/g);
    const vertexUniforms = vertexSource.match(/uniform ([\w]+) ([\w]+)([\s]*)([\w]*)/g);
    const shaderUniforms = vertexUniforms ? vertexUniforms.concat(fragmentUniforms) : fragmentUniforms;
    const fragmentPragmas = {};
    fragmentSource = fragmentSource.replace(re, (match, operation, precision, type, name) => {
        fragmentPragmas[name] = true;
        if (operation === 'define') {
            return `
#ifndef HAS_UNIFORM_u_${name}
in ${precision} ${type} ${name};
#else
uniform ${precision} ${type} u_${name};
#endif
`;
        }
        else {
            return `
#ifdef HAS_UNIFORM_u_${name}
    ${precision} ${type} ${name} = u_${name};
#endif
`;
        }
    });
    vertexSource = vertexSource.replace(re, (match, operation, precision, type, name) => {
        const attrType = type === 'float' ? 'vec2' : 'vec4';
        const unpackType = name.match(/color/) ? 'color' : attrType;
        if (fragmentPragmas[name]) {
            if (operation === 'define') {
                return `
#ifndef HAS_UNIFORM_u_${name}
uniform lowp float u_${name}_t;
in ${precision} ${attrType} a_${name};
out ${precision} ${type} ${name};
#else
uniform ${precision} ${type} u_${name};
#endif
`;
            }
            else {
                if (unpackType === 'vec4') {
                    return `
#ifndef HAS_UNIFORM_u_${name}
    ${name} = a_${name};
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
                }
                else {
                    return `
#ifndef HAS_UNIFORM_u_${name}
    ${name} = unpack_mix_${unpackType}(a_${name}, u_${name}_t);
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
                }
            }
        }
        else {
            if (operation === 'define') {
                return `
#ifndef HAS_UNIFORM_u_${name}
uniform lowp float u_${name}_t;
in ${precision} ${attrType} a_${name};
#else
uniform ${precision} ${type} u_${name};
#endif
`;
            }
            else {
                if (unpackType === 'vec4') {
                    return `
#ifndef HAS_UNIFORM_u_${name}
    ${precision} ${type} ${name} = a_${name};
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
                }
                else {
                    return `
#ifndef HAS_UNIFORM_u_${name}
    ${precision} ${type} ${name} = unpack_mix_${unpackType}(a_${name}, u_${name}_t);
#else
    ${precision} ${type} ${name} = u_${name};
#endif
`;
                }
            }
        }
    });
    return { fragmentSource, vertexSource, staticAttributes: vertexAttributes, staticUniforms: shaderUniforms };
}
export function transpileVertexShaderToWebGL1(source) {
    return source
        .replace(/\bin\s/g, 'attribute ')
        .replace(/\bout\s/g, 'varying ')
        .replace(/texture\(/g, 'texture2D(');
}
export function transpileFragmentShaderToWebGL1(source) {
    return source
        .replace(/\bin\s/g, 'varying ')
        .replace('out highp vec4 fragColor;', '')
        .replace(/fragColor/g, 'gl_FragColor')
        .replace(/texture\(/g, 'texture2D(');
}
//# sourceMappingURL=shaders.js.map