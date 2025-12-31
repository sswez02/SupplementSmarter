import { defineConfig } from 'vitest/config';
import path from 'node:path';

const SCRAPE = process.env.SCRAPE_TESTING === '1';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.ts'],
    testTimeout: SCRAPE ? 120_000 : 10_000,
  },
});
