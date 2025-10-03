import { type Subscription } from './util';
export type Listener = (a: any) => any;
type Listeners = {
    [_: string]: Array<Listener>;
};
export declare class Event {
    readonly type: string;
    constructor(type: string, data?: any);
}
interface ErrorLike {
    message: string;
}
export declare class ErrorEvent extends Event {
    error: ErrorLike;
    constructor(error: ErrorLike, data?: any);
}
export declare class Evented {
    _listeners: Listeners;
    _oneTimeListeners: Listeners;
    _eventedParent: Evented;
    _eventedParentData: any | (() => any);
    on(type: string, listener: Listener): Subscription;
    off(type: string, listener: Listener): this;
    once(type: string, listener?: Listener): this | Promise<any>;
    fire(event: Event | string, properties?: any): this;
    listens(type: string): boolean;
    setEventedParent(parent?: Evented | null, data?: any | (() => any)): this;
}
export {};
//# sourceMappingURL=evented.d.ts.map