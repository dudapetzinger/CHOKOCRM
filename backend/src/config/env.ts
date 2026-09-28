import 'dotenv/config';
import cron from 'node-cron';
import { z } from 'zod';

const envSchema = z.object({
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
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
