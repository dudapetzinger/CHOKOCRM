/**
 * Roda antes de qualquer módulo ser carregado (`setupFiles` do Jest), ainda
 * antes de `config/env.ts` ler `backend/.env` com `dotenv`. `dotenv` não
 * sobrescreve uma variável já presente em `process.env`, então fixar
 * `ERP_MOCK_FALHAR=false` e `ERP_PROVIDER=mock` aqui garante que os testes
 * sempre rodem contra o `MockErpProvider` disponível, mesmo que o `.env`
 * local tenha ficado com `ERP_MOCK_FALHAR=true` de um smoke test manual
 * (o que faria todo teste do caminho OK falhar, já com o banco truncado).
 */
process.env.ERP_MOCK_FALHAR = 'false';
process.env.ERP_PROVIDER = 'mock';
// Pelo mesmo motivo, os testes nunca mandam e-mail de verdade: com SMTP_HOST
// vazio (e NODE_ENV=test) o provedor é o ConsoleEmailProvider, que guarda as
// mensagens em memória para os testes lerem o link de redefinição.
process.env.SMTP_HOST = '';
