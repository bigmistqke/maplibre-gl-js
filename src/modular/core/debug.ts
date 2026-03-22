// src/modular/core/debug.ts
export function createDebug(title: string, enabled: boolean) {
    return enabled
        ? (msg: string, ...rest: unknown[]) => { console.log(`[${title}]`, msg, ...rest); }
        : () => {};
}
