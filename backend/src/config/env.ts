import 'dotenv/config';
import cron from 'node-cron';
import { z } from 'zod';

/**
 * Variáveis de ambiente validadas com Zod na subida: valor inválido = a API
 * não sobe. A data do modo demonstração não é variável de ambiente: mora no
 * banco (tabela `configuracoes`, ver `lib/relogio.ts`). O app não
 * manda e-mail (senha provisória pelo gestor): sem `SMTP_*`, `EMAIL_FROM` e
 * `APP_URL`, que, se ainda estiverem no ambiente, são ignoradas.
 */

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  JWT_EXPIRES_IN: z.string().min(1).default('8h'),
  FRONTEND_URL: z.string().min(1).default('http://localhost:5173'),
  UPLOADS_DIR: z.string().min(1).default('./uploads'),
  AGENDA_JOB_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  AGENDA_JOB_CRON: z
    .string()
    .min(1)
    .default('0 6 * * *')
    .refine((v) => cron.validate(v), {
      message: 'AGENDA_JOB_CRON deve ser uma expressão cron válida.',
    }),
  FOTOS_JOB_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  FOTOS_JOB_CRON: z
    .string()
    .min(1)
    .default('30 3 * * *')
    .refine((v) => cron.validate(v), {
      message: 'FOTOS_JOB_CRON deve ser uma expressão cron válida.',
    }),
  FOTOS_RETENCAO_DIAS: z.coerce.number().int().positive().default(90),
  // mock = ERP simulado de demonstração (pelo erpId); importado = só as notas
  // fiscais importadas (DANFEs em PDF, Etapa 12b, pelo CNPJ); hibrido = as
  // notas para o cliente que tem nota do CNPJ e o simulado para os demais (o
  // padrão e o de produção). Os testes fixam mock (tests/setup-env.ts).
  ERP_PROVIDER: z.enum(['mock', 'importado', 'hibrido']).default('hibrido'),
  ERP_MOCK_FALHAR: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  // Vazia = telemetria do Application Insights desligada (dev, testes, CI).
  APPLICATIONINSIGHTS_CONNECTION_STRING: z.string().default(''),
  // Pasta com o build do frontend (frontend/dist) servida pela própria API.
  // Vazia = a API não serve o frontend (dev, testes, CI).
  WEB_DIR: z.string().default(''),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
