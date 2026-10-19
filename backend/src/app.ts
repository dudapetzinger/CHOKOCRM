import { existsSync } from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { env } from './config/env';
import { AppError } from './errors/AppError';
import { ErrorCode } from './errors/errorCodes';
import { logger } from './lib/logger';
import { errorHandler } from './middlewares/errorHandler';
import { requestLogger } from './middlewares/requestLogger';
import { agendaRouter } from './routes/agenda.routes';
import { authRouter } from './routes/auth.routes';
import { campaignsRouter } from './routes/campaign.routes';
import { clientRouter } from './routes/client.routes';
import { clientContactsRouter, contactRouter } from './routes/contact.routes';
import { erpRouter } from './routes/erp.routes';
import { healthRouter } from './routes/health.routes';
import { clientInsightsRouter, insightsRouter } from './routes/insights.routes';
import { dashboardRouter } from './routes/kpis.routes';
import { produtosRouter } from './routes/produtos.routes';
import { recurrenceRouter } from './routes/recurrence.routes';
import { clientStockMessageRouter, stockMessagesRouter } from './routes/stock-message.routes';
import { usersRouter } from './routes/user.routes';
import { clientVisitsRouter, visitRouter } from './routes/visit.routes';

export const app: Express = express();

// Habilita o frontend (origem separada em dev, ver frontend/.env.example;
// em produção a mesma origem da API, ver WEB_DIR abaixo) a consumir a API.
// Autenticação usa Bearer token (sem cookies), então
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
app.use('/agenda', agendaRouter);
app.use('/auth', authRouter);
app.use('/campaigns', campaignsRouter);
app.use('/clients', clientRouter);
app.use('/clients/:id/contacts', clientContactsRouter);
app.use('/clients/:id/recurrence', recurrenceRouter);
app.use('/clients/:id/erp', erpRouter);
app.use('/erp', produtosRouter);
app.use('/clients/:id/stock-message', clientStockMessageRouter);
app.use('/stock-messages', stockMessagesRouter);
app.use('/clients/:id/insights', clientInsightsRouter);
app.use('/insights', insightsRouter);
app.use('/dashboard', dashboardRouter);
app.use('/users', usersRouter);
app.use('/contacts', contactRouter);
app.use('/clients/:id/visits', clientVisitsRouter);
// Corpo binário apenas para as imagens de check-in: o filtro de `type`
// deixa os corpos JSON (ex.: PATCH /visits/:id) seguirem no express.json.
app.use(
  '/visits',
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }),
  visitRouter,
);

// Frontend (build do Vite) servido pela própria API em produção — um host só
// no App Service (ADR-007). Fica depois dos routers: a API sempre tem
// prioridade. Arquivos de `assets/` têm hash no nome e podem ficar em cache
// para sempre; o `index.html` é revalidado a cada navegação. Os arquivos do
// PWA na raiz (service worker, registro, Workbox e manifest — ADR-012) têm
// nome fixo e também são revalidados sempre, senão uma versão nova do app
// demoraria a chegar a quem já instalou.
const ARQUIVOS_PWA = /^(sw\.js|registerSW\.js|manifest\.webmanifest|workbox-[\w-]+\.js)$/;

if (env.WEB_DIR) {
  const webDir = path.resolve(env.WEB_DIR);
  if (existsSync(webDir)) {
    const pastaAssets = path.join(webDir, 'assets') + path.sep;
    app.use(
      express.static(webDir, {
        index: false,
        setHeaders: (res, arquivo) => {
          res.setHeader('X-Content-Type-Options', 'nosniff');
          if (arquivo.startsWith(pastaAssets)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else if (path.dirname(arquivo) === webDir && ARQUIVOS_PWA.test(path.basename(arquivo))) {
            res.setHeader('Cache-Control', 'no-cache');
          }
        },
      }),
    );
    // Fallback da SPA: a raiz e as navegações do browser (Accept com
    // text/html) recebem o index.html, e o React Router resolve a rota. O
    // `fetch` do frontend manda `*/*` e segue para o 404 JSON abaixo.
    app.use((req: Request, res: Response, next: NextFunction) => {
      const ehLeitura = req.method === 'GET' || req.method === 'HEAD';
      const ehNavegacao = req.path === '/' || (req.headers.accept ?? '').includes('text/html');
      if (!ehLeitura || !ehNavegacao) {
        next();
        return;
      }
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // `root` (em vez de caminho absoluto): a checagem de dotfiles do `send`
      // vale só para o caminho relativo, não para os segmentos do WEB_DIR
      // (ex.: um WEB_DIR sob `.cache/`). Se os headers já saíram (cliente
      // desconectou no meio), não há resposta de erro a mandar.
      res.sendFile('index.html', { root: webDir }, (err) => {
        if (err && !res.headersSent) next(err);
      });
    });
  } else {
    logger.warn({ webDir }, 'WEB_DIR não existe: a API sobe sem servir o frontend');
  }
}

app.use((_req: Request, _res: Response, next: NextFunction) => {
  next(new AppError(ErrorCode.NOT_FOUND, 'Rota não encontrada.', 404));
});

app.use(errorHandler);
