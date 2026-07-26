import { defineConfig, coverageConfigDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text-summary'],
      // src/index.ts is a pure re-export barrel with no branching logic of its
      // own — every export it re-exposes is already covered via its own
      // module's tests, so instrumenting the barrel just adds noise.
      exclude: [...coverageConfigDefaults.exclude, 'src/index.ts'],
    },
  },
});
