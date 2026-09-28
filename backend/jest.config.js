/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  clearMocks: true,
  // Fixa ERP_MOCK_FALHAR/ERP_PROVIDER antes de `config/env.ts` ler o .env
  // (M7 da revisão final da Etapa 5) — ver comentário em tests/setup-env.ts.
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
};
