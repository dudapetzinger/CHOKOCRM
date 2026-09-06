import type { Role } from '@prisma/client';

/**
 * Aumenta o `Request` do Express com o usuário autenticado, preenchido pelo
 * middleware `authJwt` a partir do payload do JWT (`{ sub, role }`).
 */
declare module 'express-serve-static-core' {
  interface Request {
    user?: {
      id: string;
      role: Role;
    };
  }
}
