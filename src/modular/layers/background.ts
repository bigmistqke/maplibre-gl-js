import type {ProgramDefinition, ResolvedPaintProperties} from '@modular/core/types.ts';

export interface BackgroundLayerOptions {
    color?: string;
    opacity?: number;
}

function parseHexColor(hex: string): [number, number, number] {
    const h = hex.replace('#', '');
    if (h.length === 3) {
        return [
            parseInt(h[0] + h[0], 16) / 255,
            parseInt(h[1] + h[1], 16) / 255,
            parseInt(h[2] + h[2], 16) / 255,
        ];
    }
    return [
        parseInt(h.slice(0, 2), 16) / 255,
        parseInt(h.slice(2, 4), 16) / 255,
        parseInt(h.slice(4, 6), 16) / 255,
    ];
}

export class BackgroundLayer {
    readonly type = 'background' as const;

    static programs: ProgramDefinition[] = [];
    static TileService: undefined = undefined;

    color: string;
    opacity: number;

    constructor(options: BackgroundLayerOptions) {
        this.color = options.color ?? '#000000';
        this.opacity = options.opacity ?? 1;
    }

    drawBackground(ctx: { gl: WebGLRenderingContext; paint: ResolvedPaintProperties }): void {
        const {gl, paint} = ctx;
        const color = (paint['color'] as string | undefined) ?? this.color;
        const opacity = (paint['opacity'] as number | undefined) ?? this.opacity;
        const [r, g, b] = parseHexColor(color);
        gl.clearColor(r, g, b, opacity);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }
}
