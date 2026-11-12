/**
 * "Modo demonstração" no topo da tela de login (spec 2026-11-09, §3 "Tela de
 * login (T5)"). Sem data ativa: um botão discreto "Modo demonstração". Com a
 * data ativa (relógio público `useRelogio`, `GET /sistema/relogio`): a mesma
 * `FaixaDataSimulada` das telas logadas, com um botão "alterar" no fim.
 *
 * Os dois abrem o painel: data da demonstração (padrão: a data ativa, ou o
 * hoje de `agora()` em São Paulo), "Voltar ao real" (manda `data: null`), o
 * aviso de que a recriação apaga os dados da demonstração e a senha da conta
 * Gestão (o e-mail é a constante do produto, `EMAIL_DA_GESTAO`). "Aplicar"
 * chama `definirDemonstracao` (sem o token salvo: um 401 aqui não desloga
 * ninguém); a recriação leva alguns segundos, então o botão mostra
 * "Recriando a demonstração…" e tudo fica desabilitado (Esc e o fundo também
 * não fecham). No sucesso: o relógio da resposta vale na hora
 * (`definirRelogio` + cache `['sistema', 'relogio']`), o cache é invalidado
 * para buscar de novo, toast e o painel fecha. 401/403/409 aparecem no painel
 * com a mensagem da API; 400 com uma mensagem genérica.
 *
 * Mesmo padrão de diálogo do `SeletorDeClienteParaCheckIn` (o projeto não tem
 * `Dialog` do shadcn): `role="dialog"` modal sobre fundo escurecido em
 * `document.body`, foco na data ao abrir, Tab preso no painel, Esc/"Cancelar"/
 * toque no fundo fecham, e o foco volta ao botão que abriu (ou ao que tomou
 * o lugar dele, depois de ligar/desligar o modo).
 */
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useRelogio } from '@/hooks/useRelogio';
import { hojeEmSaoPaulo } from '@/lib/calendario';
import { formatarDataCalendario } from '@/lib/formatarData';
import { agora, definirRelogio } from '@/lib/relogio';
import { ApiError } from '@/services/api';
import { mensagemErroApi } from '@/services/clients';
import { definirDemonstracao, type DefinirDemonstracaoInput, type Relogio } from '@/services/sistema';
import { Aviso, Campo } from './crm/ui';
import { FaixaDataSimulada } from './crm/FaixaDataSimulada';

/** A conta que pode recriar a demonstração (constante pública do produto). */
export const EMAIL_DA_GESTAO = 'gestao@chokolaten.com.br';

const AVISO =
  'Isto apaga os clientes da demonstração (com contatos, visitas, pedidos e lembretes), as campanhas e as metas e recria a demonstração nessa data. Os clientes reais (cadastrados à mão ou pela nota) e as contas de acesso são mantidos.';
const ERRO_GENERICO = 'Não foi possível recriar a demonstração. Confira a data e a senha.';

const FOCAVEIS = 'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])';

function mensagemDoErro(erro: unknown): string {
  if (erro instanceof ApiError && erro.code === 'VALIDATION_ERROR') return ERRO_GENERICO;
  return mensagemErroApi(erro, ERRO_GENERICO);
}

export function ModoDemonstracao() {
  const { data: relogio } = useRelogio();
  const [aberto, setAberto] = useState(false);
  const [focarGatilho, setFocarGatilho] = useState(false);
  const gatilhoRef = useRef<HTMLButtonElement>(null);

  const dataAtiva = relogio?.simulado ? relogio.dataDeDemonstracao : null;

  // Depois de fechar, o foco volta ao gatilho que estiver na tela (o botão
  // pode ter virado o "alterar" da faixa, ou o contrário).
  useEffect(() => {
    if (!aberto && focarGatilho) {
      gatilhoRef.current?.focus();
      setFocarGatilho(false);
    }
  }, [aberto, focarGatilho]);

  function fechar() {
    setAberto(false);
    setFocarGatilho(true);
  }

  return (
    <>
      {dataAtiva ? (
        <FaixaDataSimulada
          simulado
          dataDeDemonstracao={dataAtiva}
          acao={
            <button
              ref={gatilhoRef}
              type="button"
              onClick={() => setAberto(true)}
              className="ml-1 rounded px-1 text-sm font-semibold underline underline-offset-2 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              alterar
            </button>
          }
        />
      ) : (
        <div className="flex justify-end px-2 pt-2">
          <Button
            ref={gatilhoRef}
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-muted-foreground"
            onClick={() => setAberto(true)}
          >
            Modo demonstração
          </Button>
        </div>
      )}
      {aberto && <PainelModoDemonstracao dataAtiva={dataAtiva} aoFechar={fechar} />}
    </>
  );
}

function PainelModoDemonstracao({ dataAtiva, aoFechar }: { dataAtiva: string | null; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const [data, setData] = useState(() => dataAtiva ?? hojeEmSaoPaulo(agora()));
  const [voltarAoReal, setVoltarAoReal] = useState(false);
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const idTitulo = useId();
  const idData = useId();
  const idSenha = useId();
  const idAviso = useId();
  const painelRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef<HTMLInputElement>(null);

  const recriar = useMutation({
    mutationFn: (entrada: DefinirDemonstracaoInput) => definirDemonstracao(entrada),
    onSuccess: async ({ relogio }: { relogio: Relogio }) => {
      definirRelogio(relogio);
      queryClient.setQueryData(['sistema', 'relogio'], relogio);
      toast.success(
        relogio.simulado && relogio.dataDeDemonstracao
          ? `Demonstração recriada em ${formatarDataCalendario(relogio.dataDeDemonstracao)}`
          : 'Modo demonstração desligado',
      );
      aoFechar();
      await queryClient.invalidateQueries({ queryKey: ['sistema', 'relogio'] });
    },
    onError: (falha) => setErro(mensagemDoErro(falha)),
  });
  const ocupado = recriar.isPending;

  useEffect(() => {
    dataRef.current?.focus();
  }, []);

  // Esc no documento (um toque fora dos controles tira o foco do painel);
  // no meio da recriação o painel não fecha.
  useEffect(() => {
    function aoTeclarEsc(evento: globalThis.KeyboardEvent) {
      if (evento.key === 'Escape' && !ocupado) aoFechar();
    }
    document.addEventListener('keydown', aoTeclarEsc);
    return () => document.removeEventListener('keydown', aoTeclarEsc);
  }, [aoFechar, ocupado]);

  function aplicar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!voltarAoReal && !data) {
      setErro('Informe a data da demonstração.');
      return;
    }
    if (!senha) {
      setErro('Informe a senha da conta Gestão.');
      return;
    }
    setErro(null);
    recriar.mutate({ data: voltarAoReal ? null : data, email: EMAIL_DA_GESTAO, senha });
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
      data-testid="fundo-do-modo-demonstracao"
      className="fixed inset-0 z-40 flex items-end justify-center bg-foreground/40 sm:items-center sm:p-4"
      onClick={(evento) => {
        if (evento.target === evento.currentTarget && !ocupado) aoFechar();
      }}
    >
      <div
        ref={painelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={idTitulo}
        aria-describedby={idAviso}
        onKeyDown={prenderTab}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card px-4 pt-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-foreground shadow-lg sm:rounded-2xl sm:pb-4"
      >
        <h2 id={idTitulo} className="text-base font-semibold">
          Modo demonstração
        </h2>

        <form onSubmit={aplicar} noValidate className="mt-4 space-y-4">
          <Campo rotulo="Data da demonstração" htmlFor={idData}>
            <Input
              ref={dataRef}
              id={idData}
              type="date"
              value={data}
              onChange={(evento) => setData(evento.target.value)}
              disabled={ocupado || voltarAoReal}
            />
          </Campo>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={voltarAoReal}
              onChange={(evento) => setVoltarAoReal(evento.target.checked)}
              disabled={ocupado}
            />
            Voltar ao real
          </label>

          <Aviso id={idAviso} tom="atencao">
            {AVISO}
          </Aviso>

          <Campo rotulo="Senha da conta Gestão" htmlFor={idSenha} ajuda={`Conta: ${EMAIL_DA_GESTAO}`}>
            <Input
              id={idSenha}
              type="password"
              autoComplete="current-password"
              value={senha}
              onChange={(evento) => setSenha(evento.target.value)}
              disabled={ocupado}
            />
          </Campo>

          {erro && (
            <Aviso tom="erro" role="alert">
              {erro}
            </Aviso>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={aoFechar} disabled={ocupado}>
              Cancelar
            </Button>
            <Button type="submit" disabled={ocupado}>
              {ocupado ? 'Recriando a demonstração…' : 'Aplicar'}
            </Button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}
