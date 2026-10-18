/**
 * Legenda das situações (Etapa 7, spec 5.1): botão-ícone `help-circle` na
 * barra de ferramentas de Clientes, que abre um balão (Popover do protótipo,
 * Etapa 8) com a régua da classificação, uma frase por situação, cada uma
 * com o ponto da sua cor. Os textos são os do app e os números vêm de
 * config/classificacao.ts (a régua do protótipo é outra, spec 5).
 */
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  LIMIAR_LARANJA_DIAS,
  LIMIAR_SEM_COMPRA_DIAS,
  LIMIAR_VERDE_AMARELO_DIAS,
} from '../config/classificacao';
import type { Cor } from '../services/clients';
import { CLASSES_COR } from './crm/ui';

/** Uma frase por situação; a do rebaixamento por falta de compra não tem cor própria. */
const FRASES: readonly { cor: Cor | null; texto: string }[] = [
  { cor: 'VERDE', texto: `Em dia: visitado há até ${LIMIAR_VERDE_AMARELO_DIAS} dias, com venda.` },
  { cor: 'AMARELO', texto: `Atenção: visitado há até ${LIMIAR_VERDE_AMARELO_DIAS} dias, sem venda.` },
  { cor: 'LARANJA', texto: `Vencendo: ${LIMIAR_VERDE_AMARELO_DIAS + 1} a ${LIMIAR_LARANJA_DIAS} dias sem visita.` },
  { cor: 'VERMELHO', texto: `Atrasado: mais de ${LIMIAR_LARANJA_DIAS} dias ou nunca visitado.` },
  { cor: null, texto: `Cliente sem compra no ERP há mais de ${LIMIAR_SEM_COMPRA_DIAS} dias cai para Vencendo.` },
];

export function LegendaSituacao() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="shrink-0 bg-card" aria-label="Legenda das situações">
          <HelpCircle aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] space-y-2 text-sm">
        <p className="font-semibold">Legenda das situações</p>
        <ul className="space-y-2">
          {FRASES.map(({ cor, texto }) => (
            <li key={texto} className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className={cn('mt-1.5 inline-block size-2.5 shrink-0 rounded-full', cor ? CLASSES_COR[cor].ponto : 'bg-transparent')}
              />
              {texto}
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
