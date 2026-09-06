const js = require('@eslint/js');
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // O próprio TypeScript já cobre identificadores não declarados;
      // no-undef gera falsos positivos em tipos e globais do Node/Jest.
      'no-undef': 'off',
      // Parâmetros prefixados com "_" são propositalmente não usados
      // (ex.: "next" exigido pela assinatura de 4 args do error handler do Express).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
