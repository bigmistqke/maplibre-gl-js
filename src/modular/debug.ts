// src/modular/debug.ts
/**
 * Creates a scoped debug logging function.
 *
 * Returns `undefined` in production builds (import.meta.env.PROD), allowing
 * the bundler to tree-shake all debug call sites via optional chaining.
 *
 * Usage:
 *   const debug = createDebug?.('TextLayer', false)
 *   debug?.('draw called', { key })
 *
 * Enable specific subjects at runtime (works in main thread and workers):
 *   globalThis.__DEBUG__ = '*'              // enable all
 *   globalThis.__DEBUG__ = 'TextLayer,Glyph' // enable specific subjects
 */
export const createDebug = !import.meta.env.PROD
  ? (subject: string, enabled = false) => {
      return function debug(message: string, extra?: unknown) {
        const override = (globalThis as any).__DEBUG__ as string | undefined
        const isEnabled =
          enabled ||
          override === '*' ||
          (typeof override === 'string' && override.split(',').map(s => s.trim()).includes(subject))
        if (!isEnabled) return
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
