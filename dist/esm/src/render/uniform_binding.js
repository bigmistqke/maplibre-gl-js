import { Color } from '@maplibre/maplibre-gl-style-spec';
class Uniform {
    constructor(context, location) {
        this.gl = context.gl;
        this.location = location;
    }
}
class Uniform1i extends Uniform {
    constructor(context, location) {
        super(context, location);
        this.current = 0;
    }
    set(v) {
        if (this.current !== v) {
            this.current = v;
            this.gl.uniform1i(this.location, v);
        }
    }
}
class Uniform1f extends Uniform {
    constructor(context, location) {
        super(context, location);
        this.current = 0;
    }
    set(v) {
        if (this.current !== v) {
            this.current = v;
            this.gl.uniform1f(this.location, v);
        }
    }
}
class Uniform2f extends Uniform {
    constructor(context, location) {
        super(context, location);
        this.current = [0, 0];
    }
    set(v) {
        if (v[0] !== this.current[0] || v[1] !== this.current[1]) {
            this.current = v;
            this.gl.uniform2f(this.location, v[0], v[1]);
        }
    }
}
class Uniform3f extends Uniform {
    constructor(context, location) {
        super(context, location);
        this.current = [0, 0, 0];
    }
    set(v) {
        if (v[0] !== this.current[0] || v[1] !== this.current[1] || v[2] !== this.current[2]) {
            this.current = v;
            this.gl.uniform3f(this.location, v[0], v[1], v[2]);
        }
    }
}
class Uniform4f extends Uniform {
    constructor(context, location) {
        super(context, location);
        this.current = [0, 0, 0, 0];
    }
    set(v) {
        if (v[0] !== this.current[0] || v[1] !== this.current[1] ||
            v[2] !== this.current[2] || v[3] !== this.current[3]) {
            this.current = v;
            this.gl.uniform4f(this.location, v[0], v[1], v[2], v[3]);
        }
    }
}
class UniformColor extends Uniform {
    constructor(context, location) {
        super(context, location);
        this.current = Color.transparent;
    }
    set(v) {
        if (v.r !== this.current.r || v.g !== this.current.g ||
            v.b !== this.current.b || v.a !== this.current.a) {
            this.current = v;
            this.gl.uniform4f(this.location, v.r, v.g, v.b, v.a);
        }
    }
}
class UniformColorArray extends Uniform {
    constructor(context, location) {
        super(context, location);
        this.current = new Array();
    }
    set(v) {
        if (v != this.current) {
            this.current = v;
            const values = new Float32Array(v.length * 4);
            for (let i = 0; i < v.length; i++) {
                values[4 * i] = v[i].r;
                values[4 * i + 1] = v[i].g;
                values[4 * i + 2] = v[i].b;
                values[4 * i + 3] = v[i].a;
            }
            this.gl.uniform4fv(this.location, values);
        }
    }
}
class UniformFloatArray extends Uniform {
    constructor(context, location) {
        super(context, location);
        this.current = new Array();
    }
    set(v) {
        if (v != this.current) {
            this.current = v;
            const values = new Float32Array(v);
            this.gl.uniform1fv(this.location, values);
        }
    }
}
const emptyMat4 = new Float32Array(16);
class UniformMatrix4f extends Uniform {
    constructor(context, location) {
        super(context, location);
        this.current = emptyMat4;
    }
    set(v) {
        if (v[12] !== this.current[12] || v[0] !== this.current[0]) {
            this.current = v;
            this.gl.uniformMatrix4fv(this.location, false, v);
            return;
        }
        for (let i = 1; i < 16; i++) {
            if (v[i] !== this.current[i]) {
                this.current = v;
                this.gl.uniformMatrix4fv(this.location, false, v);
                break;
            }
        }
    }
}
export { Uniform, Uniform1i, Uniform1f, Uniform2f, Uniform3f, Uniform4f, UniformColor, UniformColorArray, UniformFloatArray, UniformMatrix4f };
//# sourceMappingURL=uniform_binding.js.map