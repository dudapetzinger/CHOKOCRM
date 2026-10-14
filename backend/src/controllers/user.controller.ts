import type { NextFunction, Request, Response } from 'express';
import { roleQuerySchema } from '../schemas/user.schema';
import * as userRepository from '../repositories/user.repository';

export async function getUsers(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { role } = roleQuerySchema.parse(req.query);

    const data = await userRepository.listByRole(role);
    res.status(200).json({ data });
  } catch (err) {
    next(err);
  }
}
