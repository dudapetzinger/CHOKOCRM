/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  clearMocks: true,
  // Os hooks dos testes de integração fazem bcrypt + login + cadastros no
  // Postgres; sob carga passavam de 5 s (visits.test, clients.test) e
  // falhavam por timeout sem defeito no código. 15 s dá folga sem esconder
  // um teste travado.
  testTimeout: 15_000,
  // Cobertura só é coletada com `--coverage` (CI); lcov alimenta o SonarCloud.
  coverageDirectory: 'coverage',
  coverageReporters: ['lcov', 'text-summary'],
  collectCoverageFrom: ['src/**/*.ts'],
  // Fixa ERP_MOCK_FALHAR/ERP_PROVIDER antes de `config/env.ts` ler o .env
  // (M7 da revisão final da Etapa 5) — ver comentário em tests/setup-env.ts.
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
};
