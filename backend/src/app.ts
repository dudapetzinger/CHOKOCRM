import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { env } from './config/env';
import { AppError } from './errors/AppError';
import { ErrorCode } from './errors/errorCodes';
import { errorHandler } from './middlewares/errorHandler';
import { requestLogger } from './middlewares/requestLogger';
import { authRouter } from './routes/auth.routes';
import { clientRouter } from './routes/client.routes';
import { clientContactsRouter, contactRouter } from './routes/contact.routes';
import { healthRouter } from './routes/health.routes';

export const app: Express = express();

// Habilita o frontend (origem separada em dev, ver frontend/.env.example)
// a consumir a API. Autenticação usa Bearer token (sem cookies), então
// `credentials` não precisa ser habilitado. Usa uma função (em vez de uma
// string estática) para que apenas requisições com Origin === FRONTEND_URL
// recebam Access-Control-Allow-Origin — origens diferentes seguem sem o
// header, e o navegador bloqueia a leitura da resposta.
app.use(
  cors({
    origin: (origin, callback) => {
      callback(null, !origin || origin === env.FRONTEND_URL);
    },
  }),
);
app.use(express.json());
app.use(requestLogger);

app.use(healthRouter);
app.use('/auth', authRouter);
app.use('/clients', clientRouter);
app.use('/clients/:id/contacts', clientContactsRouter);
app.use('/contacts', contactRouter);

app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(ErrorCode.NOT_FOUND, 'Rota não encontrada.', 404));
});

app.use(errorHandler);
