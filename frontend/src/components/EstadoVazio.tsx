import type { ReactNode } from 'react';
import { Icone, type NomeDoIcone } from './Icone';

/**
 * Estado vazio de listas e cartões: ícone decorativo à frente de uma frase
 * curta (ver `.vazio` em styles/global.css, seção 23).
 */
export function EstadoVazio({ icone, children }: { icone: NomeDoIcone; children: ReactNode }) {
  return (
    <p className="vazio">
      <Icone nome={icone} className="vazio-icone" />
      <span>{children}</span>
    </p>
  );
}
