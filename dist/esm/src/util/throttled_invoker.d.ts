export declare class ThrottledInvoker {
    _channel: MessageChannel;
    _triggered: boolean;
    _methodToThrottle: Function;
    constructor(methodToThrottle: Function);
    trigger(): void;
    remove(): void;
}
//# sourceMappingURL=throttled_invoker.d.ts.map