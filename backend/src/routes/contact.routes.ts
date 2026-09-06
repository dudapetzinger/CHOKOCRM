import { Router } from 'express';
import { deleteContact, postContact, putContact } from '../controllers/contact.controller';
import { authJwt } from '../middlewares/authJwt';

/**
 * Router aninhado sob `/clients/:id/contacts` (montado com `mergeParams`
 * para enxergar o `:id` do cliente definido no prefixo do app.ts).
 */
export const clientContactsRouter = Router({ mergeParams: true });

clientContactsRouter.use(authJwt);
clientContactsRouter.post('/', postContact);

/** Router para o recurso de contato isolado, montado em `/contacts`. */
export const contactRouter = Router();

contactRouter.use(authJwt);
contactRouter.put('/:id', putContact);
contactRouter.delete('/:id', deleteContact);
