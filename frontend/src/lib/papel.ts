import type { Role } from '../auth/auth-context';

/** Nome do papel na tela (menu da conta, etiqueta na lista de usuários). */
export const ROTULO_PAPEL: Record<Role, string> = { GESTOR: 'Gestor', REPRESENTANTE: 'Representante' };

/** Opções do segmentado "Papel" (novo usuário e edição), representante primeiro. */
export const OPCOES_PAPEL = [
  { valor: 'REPRESENTANTE', rotulo: ROTULO_PAPEL.REPRESENTANTE },
  { valor: 'GESTOR', rotulo: ROTULO_PAPEL.GESTOR },
] as const;
