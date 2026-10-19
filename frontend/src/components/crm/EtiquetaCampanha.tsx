/**
 * Etiqueta da campanha vinculada (spec 7.2, 7.4 e 7.7): no histórico de
 * visitas, no aviso da próxima visita e na linha da agenda. Azul das
 * campanhas, com o texto em `--chart-text` (5,7:1 sobre o cartão, 4,9:1
 * sobre o laranja suave do aviso). O ícone é decorativo; o leitor de tela
 * ouve "Campanha: Nome", já que a etiqueta sozinha não diz o que é.
 */
import { Megaphone } from 'lucide-react';
import { Etiqueta } from './ui';

export function EtiquetaCampanha({ nome }: { nome: string }) {
  return (
    <Etiqueta tom="azul">
      <span className="inline-flex min-w-0 items-center gap-1 break-words">
        <Megaphone aria-hidden="true" className="size-3 shrink-0" />
        <span className="sr-only">Campanha: </span>
        {nome}
      </span>
    </Etiqueta>
  );
}
