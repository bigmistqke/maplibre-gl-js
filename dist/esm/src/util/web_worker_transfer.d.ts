type SerializedObject<S extends Serialized = any> = {
    [_: string]: S;
};
export type Serialized = null | void | boolean | number | string | Boolean | Number | String | Date | RegExp | ArrayBuffer | ArrayBufferView | ImageData | ImageBitmap | Blob | Array<Serialized> | SerializedObject;
type RegisterOptions<T> = {
    omit?: ReadonlyArray<keyof T>;
    shallow?: ReadonlyArray<keyof T>;
};
export declare function register<T extends any>(name: string, klass: {
    new (...args: any): T;
}, options?: RegisterOptions<T>): void;
export declare function serialize(input: unknown, transferables?: Array<Transferable> | null): Serialized;
export declare function deserialize(input: Serialized): unknown;
export {};
//# sourceMappingURL=web_worker_transfer.d.ts.map