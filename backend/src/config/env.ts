import 'dotenv/config';
import cron from 'node-cron';
import { z } from 'zod';

/**
 * Variáveis de ambiente validadas com Zod na subida: valor inválido = a API
 * não sobe. Inclui a data de demonstração opcional (`DATA_DE_DEMONSTRACAO`,
 * `AAAA-MM-DD` ou ancorada `AAAA-MM-DD@AAAA-MM-DD`),
 * que `lib/relogio.ts` usa para deslocar o "hoje" do sistema.
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

/** APP_URL efetiva: a explícita ou, sem ela (ausente ou vazia), a FRONTEND_URL. */
function appUrlEfetiva(valores: { APP_URL?: string; FRONTEND_URL: string }): string {
  return valores.APP_URL || valores.FRONTEND_URL;
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
  // Envio de e-mail (link de redefinição de senha). SMTP_HOST vazio = sem
  // SMTP: fora de produção o e-mail vai para o log (ConsoleEmailProvider);
  // em produção a redefinição responde 503 (ver providers/email/index.ts).
  SMTP_HOST: z.string().default(''),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().default(''),
  SMTP_PASS: z.string().default(''),
  EMAIL_FROM: z.string().default(''),
  // Endereço público do app (frontend), base do link enviado por e-mail.
  // Vem sempre daqui, nunca de um header da requisição. Ausente ou vazia =
  // FRONTEND_URL: em produção a API serve o próprio front (WEB_DIR), então é
  // o mesmo endereço https do App Service; em dev/test, o Vite local.
  APP_URL: z.string().optional(),
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
})
  // Em produção, o link do e-mail precisa ser https: valor efetivo sem
  // https (ex.: só o padrão localhost) e a API não sobe, em vez de mandar
  // links quebrados ou em texto puro.
  .superRefine((valores, ctx) => {
    if (valores.NODE_ENV === 'production' && !appUrlEfetiva(valores).startsWith('https://')) {
      ctx.addIssue({
        code: 'custom',
        path: ['APP_URL'],
        message: 'Em produção, APP_URL (ou, sem ela, FRONTEND_URL) deve começar com https://.',
      });
    }
  })
  .transform((valores) => ({ ...valores, APP_URL: appUrlEfetiva(valores) }));

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
