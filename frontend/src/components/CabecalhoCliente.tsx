/**
 * Cabeçalho da ficha do cliente (Etapa 7, spec 5.5; visual do protótipo na
 * Etapa 8, spec 7.2): avatar, nome, "Cidade · Rep.: Nome", etiqueta de
 * situação, o contato principal (ou o telefone do cliente) com "Adicionar
 * contato" e as ações Ligar, WhatsApp e, com `podeCheckIn` (representante
 * dono, cliente ativo), "Novo check-in".
 *
 * Com `podeTransferir` (gestor), o nome do representante vira um select que
 * transfere o cliente na hora (`PUT /clients/:id { representanteId }`), com
 * os representantes da lista e o atual, se não estiver nela (ex.: inativo).
 *
 * As ações seguem a largura do próprio cartão (container query), não a da
 * tela: na coluna estreita ao lado da lista ou no celular, Ligar | WhatsApp
 * lado a lado e "Novo check-in" em bloco abaixo; com espaço, tudo à direita
 * do nome.
 */
import { useId, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, MessageCircle, Phone, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useRepresentantes } from '../hooks/useRepresentantes';
import { descreverSituacao } from '../lib/descreverSituacao';
import { useDevolverFoco } from '../lib/useFoco';
import { telefoneParaWaMe } from '../lib/telefone';
import { mensagemErroApi, updateCliente, type ClienteCompleto } from '../services/clients';
import { EtiquetaSituacao } from './EtiquetaSituacao';
import { Avatar, Etiqueta } from './crm/ui';
import { NovoContato } from './crm/NovoContato';

const MENSAGEM_ERRO_TRANSFERIR = 'Não foi possível transferir o cliente.';

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

/** Select "Rep.:" do gestor, que transfere o cliente para outro representante. */
function TransferirCliente({ cliente }: { cliente: ClienteCompleto }) {
  const queryClient = useQueryClient();
  const { data: representantes = [] } = useRepresentantes();
  const atual = cliente.representante;
  const opcoes = representantes.some((representante) => representante.id === atual.id)
    ? representantes
    : [...representantes, atual];

  const transferir = useMutation({
    mutationFn: (representanteId: string) => updateCliente(cliente.id, { representanteId }),
    onSuccess: (atualizado, representanteId) => {
      queryClient.setQueryData(['client', cliente.id], atualizado);
      // A carteira mudou de dono: lista, agenda e painel por representante.
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      const nome = opcoes.find((opcao) => opcao.id === representanteId)?.nome ?? atualizado.representante.nome;
      toast.success(`Cliente transferido para ${primeiroNome(nome)}`);
    },
  });

  const valor = transferir.isPending && transferir.variables ? transferir.variables : atual.id;

  return (
    <>
      <span className="inline-flex items-center gap-1">
        Rep.:
        <select
          aria-label="Transferir cliente"
          className="max-w-full rounded-md border border-input bg-card px-1.5 py-0.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 max-md:min-h-11 max-md:text-base"
          value={valor}
          disabled={transferir.isPending}
          onChange={(event) => {
            if (event.target.value !== atual.id) transferir.mutate(event.target.value);
          }}
        >
          {opcoes.map((representante) => (
            <option key={representante.id} value={representante.id}>
              {representante.nome}
            </option>
          ))}
        </select>
      </span>
      {transferir.isError && (
        <span className="basis-full text-sm font-medium text-destructive" role="alert">
          {mensagemErroApi(transferir.error, MENSAGEM_ERRO_TRANSFERIR)}
        </span>
      )}
    </>
  );
}

type Props = {
  cliente: ClienteCompleto;
  /** Representante dono da carteira e cliente ativo: mostra "Novo check-in". */
  podeCheckIn: boolean;
  /** Gestor: o representante vira o select de transferência. */
  podeTransferir: boolean;
};

export function CabecalhoCliente({ cliente, podeCheckIn, podeTransferir }: Props) {
  const idTitulo = useId();
  const [adicionandoContato, setAdicionandoContato] = useState(false);
  const { ref: botaoAdicionarContato, devolverFoco } = useDevolverFoco<HTMLButtonElement>(adicionandoContato);
  const contatoPrincipal = cliente.contatos.find((contato) => contato.principal);
  const telefone = contatoPrincipal?.telefone ?? cliente.telefone;
  const numeroInternacional = telefoneParaWaMe(telefone);

  return (
    <section className="@container rounded-xl border bg-card p-5" aria-labelledby={idTitulo}>
      <div className="flex flex-col gap-4 @2xl:flex-row @2xl:items-start @2xl:justify-between">
        <div className="flex min-w-0 gap-4">
          <Avatar nome={cliente.nomeFantasia} tamanho={48} />
          <div className="min-w-0 space-y-1.5">
            <h2 id={idTitulo} className="text-[22px] leading-tight font-semibold break-words">
              {cliente.nomeFantasia}
            </h2>
            <p className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm text-muted-foreground">
              <span>{cliente.cidade}</span>
              <span aria-hidden="true">·</span>
              {podeTransferir ? (
                <TransferirCliente cliente={cliente} />
              ) : (
                <span>Rep.: {cliente.representante.nome}</span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <EtiquetaSituacao
                cor={cliente.cor}
                texto={descreverSituacao({
                  cor: cliente.cor,
                  diasSemVisita: cliente.diasSemVisita,
                  rebaixadoPorVenda: cliente.rebaixadoPorVenda,
                  diasSemCompra: cliente.diasSemCompra,
                })}
              />
              {!cliente.ativo && <Etiqueta>Inativo</Etiqueta>}
            </div>
            {numeroInternacional && (
              <p className="text-sm">{contatoPrincipal ? `${contatoPrincipal.nome} · ${telefone}` : telefone}</p>
            )}
            {!adicionandoContato && (
              <button
                ref={botaoAdicionarContato}
                type="button"
                className="inline-flex items-center gap-1 rounded-md text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring max-md:min-h-11"
                onClick={() => setAdicionandoContato(true)}
              >
                <UserPlus aria-hidden="true" className="size-4" />
                Adicionar contato
              </button>
            )}
          </div>
        </div>

        {(numeroInternacional || podeCheckIn) && (
          <div className="grid grid-cols-2 gap-2 @md:flex @md:flex-wrap @2xl:shrink-0 @2xl:flex-nowrap">
            {numeroInternacional && (
              <>
                <Button variant="outline" asChild>
                  <a href={`tel:+${numeroInternacional}`} aria-label="Ligar">
                    <Phone aria-hidden="true" />
                    Ligar
                  </a>
                </Button>
                <Button variant="outline" asChild>
                  <a
                    href={`https://wa.me/${numeroInternacional}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="WhatsApp"
                  >
                    <MessageCircle aria-hidden="true" />
                    WhatsApp
                  </a>
                </Button>
              </>
            )}
            {podeCheckIn && (
              <Button asChild className="col-span-2">
                <Link to={`/clientes/${cliente.id}/check-in`}>
                  <Check aria-hidden="true" />
                  Novo check-in
                </Link>
              </Button>
            )}
          </div>
        )}
      </div>

      {adicionandoContato && (
        <div className="mt-4">
          <NovoContato
            clienteId={cliente.id}
            aoConcluir={() => {
              devolverFoco();
              setAdicionandoContato(false);
            }}
          />
        </div>
      )}
    </section>
  );
}
