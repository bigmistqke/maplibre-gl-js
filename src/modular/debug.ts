// src/modular/debug.ts
/**
 * Creates a scoped debug logging function.
 *
 * Returns `undefined` in production builds, allowing the bundler to tree-shake
 * all debug call sites via optional chaining.
 *
 * Usage:
 *   const debug = createDebug?.('TextLayer', false)
 *   debug?.('draw called', { key })
 */
export const createDebug = !import.meta.env.PROD
  ? (subject: string, enabled: boolean) => {
      return function debug(message: string, extra?: unknown) {
        if (!enabled) return
        if (extra !== undefined) {
          console.log(
            `%c[${subject}]%c ${message}`,
            'color: #6af; font-weight: bold',
            'color: inherit',
            extra,
          )
        } else {
          console.log(
            `%c[${subject}]%c ${message}`,
            'color: #6af; font-weight: bold',
            'color: inherit',
          )
        }
      }
    }
  : undefined
