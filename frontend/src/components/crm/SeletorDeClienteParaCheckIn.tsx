/**
 * Painel inferior "Para qual cliente?" (spec 2026-11-06, §3 B), aberto pelo
 * botão central de check-in da barra do representante (`BotaoCheckIn`).
 * Mostra os clientes ativos da carteira (`useClientesDaCarteira`), em ordem
 * alfabética, com busca pelo nome fantasia ou pela cidade sem acento nem
 * maiúsculas (`normalizarCidade`, a mesma chave do filtro de cidade da aba
 * Clientes); escolher um cliente leva a `/clientes/:id/check-in`.
 *
 * Carteira grande: só os primeiros `LIMITE_EXIBIDO` aparecem, com o aviso
 * para refinar a busca, para a lista não travar o celular.
 *
 * O projeto não tem `Sheet`/`Dialog` do shadcn: o painel é um `role="dialog"`
 * modal num fundo escurecido fixo, desenhado em `document.body` (fora da
 * navegação). Abre com o foco na busca; Esc, "Fechar" ou um toque no fundo
 * fecham; o Tab circula dentro do painel. Quem abriu decide para onde o foco
 * volta (`aoFechar({ devolverFoco })`): ao escolher um cliente a tela muda e
 * o foco não volta ao botão.
 */
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useClientesDaCarteira } from '@/hooks/useDashboard';
import { normalizarCidade } from '@/lib/roteiro';
import { mensagemErroApi, type ClienteListItem } from '@/services/clients';
import { Aviso } from './ui';

const LIMITE_EXIBIDO = 50;

const FOCAVEIS = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

/** Ativos, filtrados pela busca (nome fantasia ou cidade) e em ordem alfabética (pt-BR). */
function filtrarCarteira(clientes: readonly ClienteListItem[], busca: string): ClienteListItem[] {
  const termo = normalizarCidade(busca);
  return clientes
    .filter((cliente) => cliente.ativo)
    .filter(
      (cliente) =>
        termo === '' ||
        normalizarCidade(cliente.nomeFantasia).includes(termo) ||
        normalizarCidade(cliente.cidade).includes(termo),
    )
    .sort((a, b) => a.nomeFantasia.localeCompare(b.nomeFantasia, 'pt-BR'));
}

export function SeletorDeClienteParaCheckIn({
  representanteId,
  aoFechar,
}: {
  representanteId: string;
  aoFechar: (opcoes: { devolverFoco: boolean }) => void;
}) {
  const navigate = useNavigate();
  const { data: carteira, isPending, isError, error } = useClientesDaCarteira(representanteId);
  const [busca, setBusca] = useState('');
  const idTitulo = useId();
  const idBusca = useId();
  const painelRef = useRef<HTMLDivElement>(null);
  const buscaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    buscaRef.current?.focus();
  }, []);

  // Esc no documento, não só no painel: um toque num trecho sem controle do
  // painel tira o foco dele, e o Esc ainda precisa fechar.
  useEffect(() => {
    function aoTeclarEsc(evento: globalThis.KeyboardEvent) {
      if (evento.key === 'Escape') aoFechar({ devolverFoco: true });
    }
    document.addEventListener('keydown', aoTeclarEsc);
    return () => document.removeEventListener('keydown', aoTeclarEsc);
  }, [aoFechar]);

  const encontrados = useMemo(() => filtrarCarteira(carteira ?? [], busca), [carteira, busca]);
  const exibidos = encontrados.slice(0, LIMITE_EXIBIDO);

  function escolher(id: string) {
    navigate(`/clientes/${id}/check-in`);
    aoFechar({ devolverFoco: false });
  }

  /** Tab circula dentro do painel (modal). */
  function prenderTab(evento: KeyboardEvent<HTMLDivElement>) {
    if (evento.key !== 'Tab' || !painelRef.current) return;
    const focaveis = [...painelRef.current.querySelectorAll<HTMLElement>(FOCAVEIS)];
    const primeiro = focaveis[0];
    const ultimo = focaveis[focaveis.length - 1];
    if (!primeiro || !ultimo) return;
    if (evento.shiftKey && document.activeElement === primeiro) {
      evento.preventDefault();
      ultimo.focus();
    } else if (!evento.shiftKey && document.activeElement === ultimo) {
      evento.preventDefault();
      primeiro.focus();
    }
  }

  return createPortal(
    <div
      data-testid="fundo-do-seletor"
      className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40 print:hidden"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget) aoFechar({ devolverFoco: true });
      }}
    >
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        onKeyDown={prenderTab}
        className="flex max-h-[85vh] w-full max-w-lg flex-col gap-3 rounded-t-2xl bg-card px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom))] text-foreground shadow-lg"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 id={idTitulo} className="text-base font-semibold">
            Para qual cliente?
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Fechar"
            className="-mr-2 text-muted-foreground"
            onClick={() => aoFechar({ devolverFoco: true })}
          >
            <X aria-hidden="true" />
          </Button>
        </div>

        <label htmlFor={idBusca} className="sr-only">
          Buscar cliente
        </label>
        <Input
          ref={buscaRef}
          id={idBusca}
          type="search"
          autoComplete="off"
          placeholder="Nome ou cidade"
          value={busca}
          onChange={(evento) => setBusca(evento.target.value)}
        />

        <div className="min-h-0 flex-1 overflow-y-auto">
          {isPending && <p className="text-sm text-muted-foreground">Carregando clientes...</p>}
          {isError && (
            <Aviso tom="erro" role="alert">
              {mensagemErroApi(error, 'Não foi possível carregar os clientes.')}
            </Aviso>
          )}
          {carteira && encontrados.length === 0 && (
            <p className="py-2 text-sm text-muted-foreground">Nenhum cliente encontrado.</p>
          )}
          {exibidos.length > 0 && (
            <ul aria-label="Clientes da carteira" className="divide-y">
              {exibidos.map((cliente) => (
                <li key={cliente.id}>
                  <button
                    type="button"
                    onClick={() => escolher(cliente.id)}
                    className="flex min-h-12 w-full flex-col items-start justify-center rounded-md px-2 py-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  >
                    <span data-nome className="text-sm font-medium">
                      {cliente.nomeFantasia}
                    </span>
                    <span className="text-xs text-muted-foreground">{cliente.cidade}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {encontrados.length > LIMITE_EXIBIDO && (
            <p className="pt-2 text-xs text-muted-foreground">
              Mostrando {LIMITE_EXIBIDO} de {encontrados.length}. Refine a busca.
            </p>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
