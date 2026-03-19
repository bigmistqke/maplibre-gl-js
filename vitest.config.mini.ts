import {defineConfig} from 'vitest/config';

export default defineConfig({
    test: {
        name: 'mini',
        environment: 'node',
        include: [
            'src/mini/**/*.test.{ts,js}'
        ],
        exclude: [
            'src/mini/**/*.browser.test.{ts,js}'
        ],
        coverage: {
            provider: 'v8',
            reporter: ['json', 'html'],
            exclude: ['**/*.test.ts'],
            include: ['src/mini/**/*.{ts,js}'],
            reportsDirectory: './coverage/vitest/mini',
        },
    },
});
