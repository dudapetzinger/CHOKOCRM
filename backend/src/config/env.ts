import 'dotenv/config';
import cron from 'node-cron';
import { z } from 'zod';

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
  ERP_PROVIDER: z.enum(['mock']).default('mock'),
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
