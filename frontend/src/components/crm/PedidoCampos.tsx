/**
 * Bloco "Pedido" do check-in (spec 7.5, `checkin.$id.tsx` do protótipo):
 * total à direita; uma linha por item com produto · preço | quantidade |
 * remover; "Adicionar item". Componente controlado: a página guarda os
 * itens, mostra o bloco só com resultado Venda e envia só as linhas com
 * quantidade (as de 0 ficam de fora). O total daqui é a conta da tela; o
 * que vale é o `totalPedido` que o backend calcula com o preço do catálogo.
 *
 * Quantidade vazia vale 0 (o campo mostra o "0" do placeholder): a linha
 * nova não vem com quantidade, para uma venda sem pedido não virar pedido
 * sem querer. No celular o produto ocupa a linha inteira e a quantidade e o
 * remover ficam embaixo, para caber em 320 px.
 *
 * Foco: "Adicionar item" leva ao produto da linha nova; remover leva ao
 * "Remover" da linha que ficou no lugar (ou a "Adicionar item", se não
 * sobrou linha), porque o botão clicado some da tela.
 */
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { formatarMoeda } from '../../lib/formatarMoeda';
import type { Produto } from '../../services/erp';
import type { ItemPedido } from '../../services/visits';
import { CLASSES_SELECT } from './ui';

/** Mesmos limites do `createVisitSchema` do backend. */
const MAXIMO_ITENS = 30;
const MAXIMO_QUANTIDADE = 99999;

type Foco = { alvo: 'produto' | 'remover'; indice: number } | { alvo: 'adicionar' };

type Props = {
  produtos: Produto[];
  itens: ItemPedido[];
  aoMudar: (itens: ItemPedido[]) => void;
  /** Carregando ou erro do catálogo, dentro do bloco. */
  aviso?: ReactNode;
};

/** Inteiro de 0 a `MAXIMO_QUANTIDADE`; vazio, negativo ou inválido vira 0. */
function lerQuantidade(valor: string): number {
  const numero = Number.parseInt(valor, 10);
  if (Number.isNaN(numero) || numero < 0) return 0;
  return Math.min(numero, MAXIMO_QUANTIDADE);
}

export function PedidoCampos({ produtos, itens, aoMudar, aviso }: Props) {
  const idTitulo = useId();
  const selects = useRef<(HTMLSelectElement | null)[]>([]);
  const botoesRemover = useRef<(HTMLButtonElement | null)[]>([]);
  const botaoAdicionar = useRef<HTMLButtonElement>(null);
  const focoPendente = useRef<Foco | null>(null);

  useEffect(() => {
    const foco = focoPendente.current;
    if (!foco) return;
    focoPendente.current = null;
    if (foco.alvo === 'adicionar') botaoAdicionar.current?.focus();
    else if (foco.alvo === 'produto') selects.current[foco.indice]?.focus();
    else botoesRemover.current[foco.indice]?.focus();
  }, [itens]);

  const precoPorSku = new Map(produtos.map((produto) => [produto.sku, produto.precoUnitario]));
  const total = itens.reduce((soma, item) => soma + item.quantidade * (precoPorSku.get(item.sku) ?? 0), 0);

  function alterar(indice: number, mudanca: Partial<ItemPedido>): void {
    aoMudar(itens.map((item, i) => (i === indice ? { ...item, ...mudanca } : item)));
  }

  function adicionar(): void {
    const emUso = new Set(itens.map((item) => item.sku));
    const produto = produtos.find((candidato) => !emUso.has(candidato.sku)) ?? produtos[0];
    if (!produto) return;
    focoPendente.current = { alvo: 'produto', indice: itens.length };
    aoMudar([...itens, { sku: produto.sku, quantidade: 0 }]);
  }

  function remover(indice: number): void {
    const restantes = itens.filter((_, i) => i !== indice);
    focoPendente.current =
      restantes.length === 0 ? { alvo: 'adicionar' } : { alvo: 'remover', indice: Math.min(indice, restantes.length - 1) };
    aoMudar(restantes);
  }

  return (
    <div role="group" aria-labelledby={idTitulo} className="space-y-3 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <span id={idTitulo} className="text-sm font-medium">
          Pedido
        </span>
        <span className="text-sm font-semibold tabular-nums">
          <span className="sr-only">Total: </span>
          {formatarMoeda(total)}
        </span>
      </div>

      {aviso}

      {itens.length > 0 && (
        // No celular cada item ocupa dois andares; o divisor mostra onde um acaba
        <ul className="max-sm:divide-y sm:space-y-2">
          {itens.map((item, indice) => {
            const numero = indice + 1;
            return (
              // Índice como chave: a linha não tem id, e os campos são controlados
              <li
                key={indice}
                className="flex flex-wrap items-center gap-2 max-sm:py-3 max-sm:first:pt-0 max-sm:last:pb-0"
              >
                <select
                  ref={(elemento) => {
                    selects.current[indice] = elemento;
                  }}
                  aria-label={`Produto do item ${numero}`}
                  className={cn(CLASSES_SELECT, 'min-w-0 basis-full sm:flex-1 sm:basis-0')}
                  value={item.sku}
                  onChange={(e) => alterar(indice, { sku: e.target.value })}
                >
                  {produtos.map((produto) => (
                    <option key={produto.sku} value={produto.sku}>
                      {`${produto.nome} · ${formatarMoeda(produto.precoUnitario)}`}
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={MAXIMO_QUANTIDADE}
                  step={1}
                  placeholder="0"
                  aria-label={`Quantidade do item ${numero}`}
                  className="w-24 sm:w-20"
                  value={item.quantidade || ''}
                  onChange={(e) => alterar(indice, { quantidade: lerQuantidade(e.target.value) })}
                />
                <Button
                  ref={(elemento) => {
                    botoesRemover.current[indice] = elemento;
                  }}
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remover item ${numero}`}
                  className="max-sm:ml-auto"
                  onClick={() => remover(indice)}
                >
                  <Trash2 aria-hidden="true" />
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        ref={botaoAdicionar}
        type="button"
        size="sm"
        variant="outline"
        disabled={produtos.length === 0 || itens.length >= MAXIMO_ITENS}
        onClick={adicionar}
      >
        <Plus aria-hidden="true" />
        Adicionar item
      </Button>
    </div>
  );
}
