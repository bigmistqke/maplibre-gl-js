import {viewTypes, type ViewType, type StructArrayLayout} from '../util/struct_array';

/**
 * Field encoding descriptor — defines how a semantic value maps to packed bytes.
 *
 * A field can either occupy its own components in the layout ("root" field),
 * or be packed into bits of another field ("bit" field).
 */
type FieldDef =
    | {
        /** Name of the GPU attribute this field writes to */
        attr: string;
        /** Which component(s) of the attribute to write (default: all) */
        components?: number | number[];
        /** Optional transform applied to each value before writing */
        encode?: (value: number) => number;
    }
    | {
        /** Name of the GPU attribute this field is packed into */
        attr: string;
        /** The component index to pack into */
        component: number;
        /** Bit position within the component */
        bit: number;
    }
    | {
        /** Name of the GPU attribute this field is packed into */
        attr: string;
        /** The component index to write the packed result to */
        component: number;
        /** Packing function: multiple values → single packed number */
        pack: (...values: number[]) => number;
    };

type FieldDefs = Record<string, FieldDef>;

interface ResolvedField {
    def: FieldDef;
    member: StructArrayLayout['members'][0];
    /** Byte offset of this field's attribute within the struct */
    attrOffset: number;
    /** TypedArray view type for this attribute */
    viewType: ViewType;
    /** Bytes per element for this view type */
    bytesPerElement: number;
}

/**
 * A StructLayout defines named, encoding-aware fields over a StructArrayLayout.
 * It writes directly to the underlying ArrayBuffer — no intermediate allocation.
 *
 * Usage:
 *   const layout = createStructLayout(gpuLayout, {
 *     pos:   { attr: 'a_pos_normal', components: [0, 1], encode: (v) => v << 1 },
 *     round: { attr: 'a_pos_normal', component: 0, bit: 0 },
 *     up:    { attr: 'a_pos_normal', component: 1, bit: 0 },
 *     extrude: { attr: 'a_data', components: [0, 1], encode: (v) => Math.round(v * 63) + 128 },
 *   });
 *
 *   const writer = layout.writer(structArray);
 *   writer.index = structArray.length;
 *   structArray.resize(structArray.length + 1);
 *   writer.pos(x, y);
 *   writer.round(true);
 *   writer.extrude(ex, ey);
 */

export interface StructWriter {
    /** Set the struct index to write to. Must be set before writing fields. */
    index: number;
}

export interface StructLayout<F extends FieldDefs> {
    /** The underlying GPU attribute layout */
    gpuLayout: StructArrayLayout;
    /** Create a writer bound to a StructArray's backing buffer */
    writer(array: {arrayBuffer: ArrayBuffer; _refreshViews(): void}): StructWriter & WriterMethods<F>;
}

// Derive writer method signatures from field definitions
type WriterMethods<F extends FieldDefs> = {
    [K in keyof F]: F[K] extends {bit: number}
        ? (value: boolean | number) => void
        : F[K] extends {pack: (...args: infer A) => number}
            ? (...values: A) => void
            : F[K] extends {components: number[]}
                ? (...values: number[]) => void
                : F[K] extends {components: number}
                    ? (...values: number[]) => void
                    : (value: number) => void;
};

const VIEW_CONSTRUCTORS: Record<ViewType, typeof Int8Array | typeof Uint8Array | typeof Int16Array | typeof Uint16Array | typeof Int32Array | typeof Uint32Array | typeof Float32Array> = {
    'Int8': Int8Array,
    'Uint8': Uint8Array,
    'Int16': Int16Array,
    'Uint16': Uint16Array,
    'Int32': Int32Array,
    'Uint32': Uint32Array,
    'Float32': Float32Array,
};

export function createStructLayout<F extends FieldDefs>(
    gpuLayout: StructArrayLayout,
    fields: F
): StructLayout<F> {
    // Resolve each field to its attribute member and compute access info
    const resolved = new Map<string, ResolvedField>();

    for (const [name, def] of Object.entries(fields)) {
        const member = gpuLayout.members.find(m => m.name === def.attr);
        if (!member) {
            throw new Error(`StructLayout: attribute "${def.attr}" not found in GPU layout. Available: ${gpuLayout.members.map(m => m.name).join(', ')}`);
        }
        const bytesPerElement = viewTypes[member.type].BYTES_PER_ELEMENT;
        resolved.set(name, {
            def,
            member,
            attrOffset: member.offset,
            viewType: member.type,
            bytesPerElement,
        });
    }

    return {
        gpuLayout,
        writer(array) {
            // Create typed views over the buffer — these get refreshed when buffer grows
            const views: Record<ViewType, InstanceType<typeof Int8Array | typeof Uint8Array | typeof Int16Array | typeof Uint16Array | typeof Int32Array | typeof Uint32Array | typeof Float32Array>> = {} as any;

            function refreshViews() {
                for (const vt of Object.keys(VIEW_CONSTRUCTORS) as ViewType[]) {
                    views[vt] = new VIEW_CONSTRUCTORS[vt](array.arrayBuffer);
                }
            }
            refreshViews();

            // Monkey-patch _refreshViews to keep our views in sync
            const original = array._refreshViews.bind(array);
            array._refreshViews = () => {
                original();
                refreshViews();
            };

            let currentIndex = 0;
            const structSize = gpuLayout.size;

            const writer: any = {};

            Object.defineProperty(writer, 'index', {
                get() { return currentIndex; },
                set(i: number) { currentIndex = i; },
            });

            for (const [name, field] of resolved) {
                const {def, attrOffset, viewType, bytesPerElement} = field;

                if ('bit' in def) {
                    // Bit field — OR a single bit into an existing component
                    const componentByteOffset = attrOffset + def.component * bytesPerElement;
                    writer[name] = (value: boolean | number) => {
                        const byteOffset = currentIndex * structSize + componentByteOffset;
                        const elemIndex = byteOffset / bytesPerElement;
                        const bitValue = (typeof value === 'boolean' ? (value ? 1 : 0) : value) << def.bit;
                        views[viewType][elemIndex] |= bitValue;
                    };
                } else if ('pack' in def) {
                    // Pack field — multiple values packed into a single component
                    const componentByteOffset = attrOffset + def.component * bytesPerElement;
                    const packFn = def.pack;
                    writer[name] = (...values: number[]) => {
                        const byteOffset = currentIndex * structSize + componentByteOffset;
                        const elemIndex = byteOffset / bytesPerElement;
                        views[viewType][elemIndex] = packFn(...values);
                    };
                } else {
                    // Component field — write one or more components
                    const encode = def.encode || ((v: number) => v);
                    const components = def.components;

                    if (components === undefined) {
                        // Single component (default: component 0)
                        writer[name] = (value: number) => {
                            const byteOffset = currentIndex * structSize + attrOffset;
                            const elemIndex = byteOffset / bytesPerElement;
                            views[viewType][elemIndex] = encode(value);
                        };
                    } else if (typeof components === 'number') {
                        // Write N components sequentially starting from 0
                        writer[name] = (...values: number[]) => {
                            const byteOffset = currentIndex * structSize + attrOffset;
                            const baseIndex = byteOffset / bytesPerElement;
                            for (let c = 0; c < components; c++) {
                                views[viewType][baseIndex + c] = encode(values[c]);
                            }
                        };
                    } else {
                        // Write to specific component indices
                        writer[name] = (...values: number[]) => {
                            const byteOffset = currentIndex * structSize + attrOffset;
                            const baseIndex = byteOffset / bytesPerElement;
                            for (let c = 0; c < components.length; c++) {
                                views[viewType][baseIndex + components[c]] = encode(values[c]);
                            }
                        };
                    }
                }
            }

            return writer as StructWriter & WriterMethods<F>;
        }
    };
}
