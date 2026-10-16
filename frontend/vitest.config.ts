import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Módulo virtual do vite-plugin-pwa (que não roda nos testes): ver o stub
      'virtual:pwa-register/react': fileURLToPath(new URL('src/test/pwaRegisterStub.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['src/test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**'],
      exclude: ['src/test/**', 'src/main.tsx', '**/*.test.*'],
    },
  },
})
