import {defineConfig} from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
    plugins: [tsconfigPaths()],
    test: {
        name: 'modular',
        environment: 'jsdom',
        setupFiles: [
            'vitest-webgl-canvas-mock',
        ],
        include: [
            'src/modular/**/*.test.{ts,js}'
        ],
        exclude: [
            'src/modular/**/*.browser.test.{ts,js}'
        ],
        coverage: {
            provider: 'v8',
            reporter: ['json', 'html'],
            exclude: ['**/*.test.ts'],
            include: ['src/modular/**/*.{ts,js}'],
            reportsDirectory: './coverage/vitest/modular',
        },
    },
});
