export const ABORT_ERROR = 'AbortError';
export function isAbortError(error) {
    return error.message === ABORT_ERROR;
}
export function createAbortError() {
    return new Error(ABORT_ERROR);
}
//# sourceMappingURL=abort_error.js.map