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
    // O jsdom é lento no CI (a maior parte do tempo da suíte): 15 s por teste
    // em vez de 5 s, para um teste lento não reprovar o job e travar o deploy.
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: 'coverage',
      include: ['src/**'],
      exclude: ['src/test/**', 'src/main.tsx', '**/*.test.*'],
    },
  },
})
