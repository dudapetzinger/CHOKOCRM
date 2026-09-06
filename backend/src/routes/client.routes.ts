import { Router } from 'express';
import { getClientById, getClients, postClient, putClient } from '../controllers/client.controller';
import { authJwt } from '../middlewares/authJwt';

export const clientRouter = Router();

clientRouter.use(authJwt);

clientRouter.get('/', getClients);
clientRouter.post('/', postClient);
clientRouter.get('/:id', getClientById);
clientRouter.put('/:id', putClient);
