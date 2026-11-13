/**
 * Painel inferior "Para qual cliente?", aberto pelo
 * botão central de check-in da barra do representante (`BotaoCheckIn`).
 * Mostra os clientes ativos da carteira (`useClientesDaCarteira`), em ordem
 * alfabética, com busca pelo nome fantasia ou pela cidade sem acento nem
 * maiúsculas (`normalizarCidade`, a mesma chave do filtro de cidade da aba
 * Clientes); escolher um cliente leva a `/clientes/:id/check-in`.
 *
 * Carteira grande: só os primeiros `LIMITE_EXIBIDO` aparecem, com o aviso
 * para refinar a busca, para a lista não travar o celular.
 *
 * O painel é o `Dialogo` do projeto (`role="dialog"` modal num fundo
 * escurecido, em `document.body`): Esc, "Fechar" ou um toque no fundo
 * fecham e o Tab circula dentro dele. Abre com o foco na busca (o `Dialogo`
 * não o tira, porque já está dentro do painel). Quem abriu decide para onde
 * o foco volta (`aoFechar({ devolverFoco })`): ao escolher um cliente a tela
 * muda e o foco não volta ao botão.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { useClientesDaCarteira } from '@/hooks/useDashboard';
import { normalizarCidade } from '@/lib/roteiro';
import { mensagemErroApi, type ClienteListItem } from '@/services/clients';
import { Dialogo } from './Dialogo';
import { Aviso } from './ui';

const LIMITE_EXIBIDO = 50;

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
  const idBusca = useId();
  const buscaRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    buscaRef.current?.focus();
  }, []);

  const encontrados = useMemo(() => filtrarCarteira(carteira ?? [], busca), [carteira, busca]);
  const exibidos = encontrados.slice(0, LIMITE_EXIBIDO);

  function escolher(id: string) {
    navigate(`/clientes/${id}/check-in`);
    aoFechar({ devolverFoco: false });
  }

  return (
    <Dialogo
      titulo="Para qual cliente?"
      aberto
      aoFechar={() => aoFechar({ devolverFoco: true })}
      largura="estreito"
      idDeTesteDoFundo="fundo-do-seletor"
    >
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
    </Dialogo>
  );
}
