import 'dotenv/config';
import cron from 'node-cron';
import { z } from 'zod';

/**
 * Variáveis de ambiente validadas com Zod na subida: valor inválido = a API
 * não sobe. Inclui a data de demonstração opcional (`DATA_DE_DEMONSTRACAO`,
 * `AAAA-MM-DD` ou ancorada `AAAA-MM-DD@AAAA-MM-DD`),
 * que `lib/relogio.ts` usa para deslocar o "hoje" do sistema. O app não
 * manda e-mail (senha provisória pelo gestor): sem `SMTP_*`, `EMAIL_FROM` e
 * `APP_URL`, que, se ainda estiverem no ambiente, são ignoradas.
 */

const MENSAGEM_DATA_DE_DEMONSTRACAO =
  'DATA_DE_DEMONSTRACAO deve ser uma data AAAA-MM-DD, opcionalmente seguida de @ e do dia real de referência (AAAA-MM-DD).';

/** `AAAA-MM-DD` que existe no calendário (`2027-02-30` não existe). */
function dataAaaaMmDdValida(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [ano, mes, dia] = valor.split('-').map(Number) as [number, number, number];
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  return data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;
}

/**
 * `DATA_DE_DEMONSTRACAO`: `AAAA-MM-DD` ou, ancorada, `AAAA-MM-DD@AAAA-MM-DD`
 * (data simulada `@` dia real de referência), com as duas datas existentes.
 */
function dataDeDemonstracaoValida(valor: string): boolean {
  const partes = valor.split('@');
  return partes.length <= 2 && partes.every(dataAaaaMmDdValida);
}

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
  // mock = ERP simulado de demonstração; importado = notas fiscais importadas
  // (DANFEs em PDF, Etapa 12b), o usado em produção.
  ERP_PROVIDER: z.enum(['mock', 'importado']).default('mock'),
  ERP_MOCK_FALHAR: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  // Vazia = telemetria do Application Insights desligada (dev, testes, CI).
  APPLICATIONINSIGHTS_CONNECTION_STRING: z.string().default(''),
  // Pasta com o build do frontend (frontend/dist) servida pela própria API.
  // Vazia = a API não serve o frontend (dev, testes, CI).
  WEB_DIR: z.string().default(''),
  // Data de demonstração (relógio simulado, ver lib/relogio.ts): o app vive
  // nesse dia com o horário real e o calendário andando. `AAAA-MM-DD@AAAA-MM-DD`
  // ancora o deslocamento num dia real de referência. Ausente ou vazia =
  // relógio real. Vale em qualquer NODE_ENV (a apresentação roda em produção).
  DATA_DE_DEMONSTRACAO: z
    .string()
    .optional()
    .transform((valor) => valor || undefined)
    .refine((valor) => valor === undefined || dataDeDemonstracaoValida(valor), {
      message: MENSAGEM_DATA_DE_DEMONSTRACAO,
    }),
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
