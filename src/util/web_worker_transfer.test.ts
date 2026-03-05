import {describe, test, expect} from 'vitest';
import {AJAXError} from './ajax';
import {register, serialize, deserialize} from './web_worker_transfer';
import type {Serialized} from './web_worker_transfer';

describe('web worker transfer', () => {
    test('round trip', () => {
        class SerializableMock {
            n: number;
            buffer: ArrayBuffer;
            blob: Blob;
            _cached: number | undefined;
            dataView: DataView;
            imageData: ImageData;
            array: Array<boolean | number | string | ArrayBuffer>;

            constructor(n: number) {
                this.n = n;
                this.buffer = new ArrayBuffer(100);
                this.dataView = new DataView(this.buffer);
                this.imageData = new ImageData(8, 5);
                this.blob = new Blob();
                this.array = [true, 1, 'one', new ArrayBuffer(100)];
                this.squared();
            }

            squared() {
                if (this._cached) {
                    return this._cached;
                }
                this._cached = this.n * this.n;
                return this._cached;
            }
        }

        register('SerializableMock', SerializableMock, {omit: ['_cached']});

        const serializableMock = new SerializableMock(10);
        const transferables: Array<Transferable> = [];
        const deserialized = deserialize(serialize(serializableMock, transferables)) as SerializableMock; // as SerializableMock: deserialize returns unknown, but we know the registered type
        expect(deserialize(serialize(serializableMock, transferables)) instanceof SerializableMock).toBeTruthy();
        expect(serializableMock.dataView instanceof DataView).toBeTruthy();

        expect(serializableMock !== deserialized).toBeTruthy();
        expect(deserialized.constructor === SerializableMock).toBeTruthy();
        expect(deserialized.n === 10).toBeTruthy();
        expect(deserialized.buffer === serializableMock.buffer).toBeTruthy();
        expect(deserialized.blob === serializableMock.blob).toBeTruthy();
        expect(transferables[0] === serializableMock.buffer).toBeTruthy();
        expect(transferables[1] === serializableMock.dataView.buffer).toBeTruthy();
        expect(deserialized._cached === undefined).toBeTruthy();
        expect(deserialized.squared() === 100).toBeTruthy();
        expect(deserialized.dataView instanceof DataView).toBeTruthy();
        expect(deserialized.array).toEqual(serializableMock.array);
    });

    test('anonymous class', () => {
        const Klass = (() => (class {}))();
        expect(!Klass.name).toBeTruthy();
        register('Anon', Klass);
        const x = new Klass();
        const deserialized = deserialize(serialize(x));
        expect(deserialized instanceof Klass).toBeTruthy();
    });

    test('custom serialization', () => {
        class CustomSerialization {
            id: string;
            _deserialized: boolean;
            constructor(id: string) {
                this.id = id;
                this._deserialized = false;
            }

            static serialize(b: CustomSerialization) {
                return {custom: `custom serialization,${b.id}`};
            }

            static deserialize(input: {custom: string}) {
                const b = new CustomSerialization(input.custom.split(',')[1]);
                b._deserialized = true;
                return b;
            }
        }

        register('CustomSerialization', CustomSerialization);

        const customSerialization = new CustomSerialization('a');
        expect(!customSerialization._deserialized).toBeTruthy();

        const deserialized = deserialize(serialize(customSerialization)) as CustomSerialization; // as CustomSerialization: deserialize returns unknown, but we know the registered type
        expect(deserialize(serialize(customSerialization)) instanceof CustomSerialization).toBeTruthy();
        expect(deserialized.id).toBe(customSerialization.id);
        expect(deserialized._deserialized).toBeTruthy();
    });

    test('AjaxError serialization', () => {
        const status = 404;
        const statusText = 'not found';
        const url = 'https://example.com';

        const ajaxError = new AJAXError(status, statusText, url, new Blob());
        const serialized = serialize(ajaxError);
        const deserialized = deserialize(serialized) as AJAXError; // as AJAXError: deserialize returns unknown, but we know the registered type
        expect(deserialized.status).toBe(404);
        expect(deserialized.statusText).toBe(statusText);
        expect(deserialized.url).toBe(url);
    });

    test('serialize Object has _classRegistryKey', () => {
        class BadClass {
            _classRegistryKey: 'foo' = 'foo';
        }
        const trySerialize = () => {
            serialize(new BadClass());
        };
        expect(trySerialize).toThrow();
    });
    test('serialize can not used reserved property #name', () => {
        class BadClass {
            static serialize() {
                return {
                    '$name': 'foo'
                };
            }
        }
        register('BadClass', BadClass);
        const badObject = new BadClass();
        expect(() => {
            serialize(badObject);
        }).toThrow();
    });
    test('deserialize Object has $name', () => {
        const badObject = {
            '$name': 'foo'
        };
        const tryDeserialize = () => {
            deserialize(badObject);
        };
        expect(tryDeserialize).toThrow();
    });

    test('some objects can not be serialized', () => {
        expect(() => {
            serialize(BigInt(123));
        }).toThrow();
    });
    test('some objects can not be deserialized', () => {
        expect(() => {
            deserialize(BigInt(123) as unknown as Serialized); // as unknown as Serialized: intentionally testing deserialization of an invalid type
        }).toThrow();
    });
});
