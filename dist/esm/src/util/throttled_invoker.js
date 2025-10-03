export class ThrottledInvoker {
    constructor(methodToThrottle) {
        this._methodToThrottle = methodToThrottle;
        this._triggered = false;
        if (typeof MessageChannel !== 'undefined') {
            this._channel = new MessageChannel();
            this._channel.port2.onmessage = () => {
                this._triggered = false;
                this._methodToThrottle();
            };
        }
    }
    trigger() {
        if (this._triggered) {
            return;
        }
        this._triggered = true;
        if (this._channel) {
            this._channel.port1.postMessage(true);
        }
        else {
            setTimeout(() => {
                this._triggered = false;
                this._methodToThrottle();
            }, 0);
        }
    }
    remove() {
        delete this._channel;
        this._methodToThrottle = () => { };
    }
}
//# sourceMappingURL=throttled_invoker.js.map