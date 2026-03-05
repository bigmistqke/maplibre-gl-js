/**
 * Throttle the given function to run at most every `period` milliseconds.
 */
export function throttle<T extends (...args: any) => void>(fn: T, time: number): (...args: Parameters<T>) => ReturnType<typeof setTimeout> | null {
    let pending = false;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let lastCallContext: unknown = null;
    let lastCallArgs: Parameters<T>;

    const later = () => {
        timerId = null;
        if (pending) {
            fn.apply(lastCallContext, lastCallArgs);
            timerId = setTimeout(later, time);
            pending = false;
        }
    };

    return function(this: unknown, ...args: Parameters<T>) {
        pending = true;
        lastCallContext = this;
        lastCallArgs = args;
        if (!timerId) {
            later();
        }
        return timerId;
    };
}
