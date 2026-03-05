/**
 * A ShaderExtension declares preprocessor defines and a cache key suffix
 * for shader program variants. Extensions are provided by the active Surface
 * and composed generically by `useProgram()`.
 */
export interface ShaderExtension {
    /** Cache key suffix, e.g. 'terrain' */
    readonly key: string;
    /** Preprocessor defines to add, e.g. ['#define TERRAIN3D;'] */
    readonly defines: readonly string[];
}
