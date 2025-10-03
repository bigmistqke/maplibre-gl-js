export function throttle(fn, time) {
    let pending = false;
    let timerId = null;
    let lastCallContext = null;
    let lastCallArgs;
    const later = () => {
        timerId = null;
        if (pending) {
            fn.apply(lastCallContext, lastCallArgs);
            timerId = setTimeout(later, time);
            pending = false;
        }
    };
    return (...args) => {
        pending = true;
        lastCallContext = this;
        lastCallArgs = args;
        if (!timerId) {
            later();
        }
        return timerId;
    };
}
//# sourceMappingURL=throttle.js.map