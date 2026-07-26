import { defineConfig, coverageConfigDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text-summary'],
      // src/index.ts is the argv-parsing/process-exit-code shell — it's
      // exercised for real by test/cli.e2e.test.ts, but as a spawned child
      // process, which V8 coverage can't see into. args.ts, model-providers.ts,
      // and review-command.ts hold the actual logic and are unit-tested
      // in-process, so they're measured normally.
      exclude: [...coverageConfigDefaults.exclude, 'src/index.ts'],
    },
  },
});
