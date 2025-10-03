export declare function throttle<T extends (...args: any) => void>(fn: T, time: number): (...args: Parameters<T>) => ReturnType<typeof setTimeout>;
//# sourceMappingURL=throttle.d.ts.map