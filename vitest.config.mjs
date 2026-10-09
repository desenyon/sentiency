import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { environment: 'jsdom', include: ['tests/unit/**/*.test.js'], restoreMocks: true, setupFiles: ['tests/unit/setup.js'] } });
