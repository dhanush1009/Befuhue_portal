import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  // Vite 8 transforms with oxc: lets component render tests compile TSX (tsconfig keeps jsx: preserve for Next)
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
