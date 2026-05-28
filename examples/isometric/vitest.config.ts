import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        // Pure-function tests run in node — no DOM needed for the
        // color-derivation math. Components that touch JointJS/DOM should
        // opt into 'jsdom' per-file via `// @vitest-environment jsdom`.
        environment: 'node',
        include: ['src/**/*.test.ts'],
    },
});
