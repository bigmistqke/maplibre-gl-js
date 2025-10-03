export const FRAMEBUFFER_NOT_COMPLETE_ERROR = 'Framebuffer is not complete';
export function isFramebufferNotCompleteError(error) {
    return error.message === FRAMEBUFFER_NOT_COMPLETE_ERROR;
}
export function createFramebufferNotCompleteError() {
    return new Error(FRAMEBUFFER_NOT_COMPLETE_ERROR);
}
//# sourceMappingURL=framebuffer_error.js.map