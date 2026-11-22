/**
 * Legenda das situações: botão-ícone `help-circle` na barra de ferramentas
 * de Clientes, que abre um balão organizado pelas abas da lista (Prioridade,
 * Atenção, Em dia e, por fim, Todos, com o inativo). Cada linha tem o ponto
 * da cor, o nome da etiqueta da lista e a regra em uma frase; os números vêm
 * de config/classificacao.ts.
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

type Linha = { cor: Cor; nome: string; regra: string };

/** Grupos na ordem das abas da lista. */
const GRUPOS: readonly { titulo: string; linhas: readonly Linha[] }[] = [
  {
    titulo: 'Prioridade',
    linhas: [
      { cor: 'VERMELHO', nome: 'Atrasado', regra: `Mais de ${LIMIAR_LARANJA_DIAS} dias sem visita, ou nunca visitado.` },
      { cor: 'LARANJA', nome: 'Vencendo', regra: `De ${LIMIAR_VERDE_AMARELO_DIAS + 1} a ${LIMIAR_LARANJA_DIAS} dias sem visita.` },
      {
        cor: 'LARANJA',
        nome: 'Rebaixado',
        regra: `Visitado há até ${LIMIAR_VERDE_AMARELO_DIAS} dias, mas sem compra há mais de ${LIMIAR_SEM_COMPRA_DIAS} dias.`,
      },
    ],
  },
  {
    titulo: 'Atenção',
    linhas: [
      {
        cor: 'AMARELO',
        nome: 'Visitado sem venda',
        regra: `Visitado há até ${LIMIAR_VERDE_AMARELO_DIAS} dias e a última visita não teve venda.`,
      },
    ],
  },
  {
    titulo: 'Em dia',
    linhas: [
      {
        cor: 'VERDE',
        nome: 'Em dia',
        regra: `Visitado há até ${LIMIAR_VERDE_AMARELO_DIAS} dias e a última visita teve venda.`,
      },
    ],
  },
];

function Ponto({ cor }: Readonly<{ cor: Cor | null }>) {
  return (
    <span
      aria-hidden="true"
      className={cn('mt-1.5 inline-block size-2.5 shrink-0 rounded-full', cor ? CLASSES_COR[cor].ponto : 'bg-transparent')}
    />
  );
}

export function LegendaSituacao() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="shrink-0 bg-card" aria-label="Legenda das situações">
          <HelpCircle aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] space-y-3 text-sm">
        <p className="font-semibold">Legenda das situações</p>
        {GRUPOS.map(({ titulo, linhas }) => (
          <section key={titulo} className="space-y-1.5">
            <h3 className="font-semibold">{titulo}</h3>
            <ul aria-label={titulo} className="space-y-1.5">
              {linhas.map(({ cor, nome, regra }) => (
                <li key={nome} className="flex items-start gap-2">
                  <Ponto cor={cor} />
                  <span className="min-w-0">
                    <span className="font-medium">{nome}</span>
                    <span className="block text-muted-foreground">{regra}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        {/* O inativo não tem cor e só aparece na aba "Todos": fica num grupo próprio. */}
        <section className="space-y-1.5">
          <h3 className="font-semibold">Todos</h3>
          <div className="flex items-start gap-2">
            <Ponto cor={null} />
            <span className="min-w-0">
              <span className="font-medium">Inativo</span>
              <span className="block text-muted-foreground">Inativado pela gestão, sem cor. Aparece só na aba Todos.</span>
            </span>
          </div>
        </section>
        <p className="border-t pt-2 text-muted-foreground">
          A cor olha só a última visita e a última compra. Negociação conta como sem venda. Quem nunca comprou não é rebaixado.
        </p>
      </PopoverContent>
    </Popover>
  );
}
