// src/modular/debug.ts
/**
 * Creates a scoped debug logging function.
 *
 * The returned function is a no-op in production builds, allowing the bundler
 * to tree-shake the body of all debug call sites.
 *
 * Usage:
 *   const debug = createDebug('TextLayer', false)
 *   debug('draw called', { key })
 */
export function createDebug(subject: string, enabled: boolean) {
  if (import.meta.env.PROD || !enabled) return _noop
  return function debug(message: string, extra?: unknown) {
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

function _noop(_message: string, _extra?: unknown) {}
