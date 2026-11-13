/**
 * Cabeçalho da ficha do cliente (visual do protótipo): avatar, nome, "Cidade · Rep.: Nome", etiqueta de
 * situação (no cliente inativo, só "Inativo"), o contato principal (ou o telefone do cliente) com "Adicionar
 * contato" e as ações Ligar, WhatsApp e, com `podeCheckIn` (representante
 * dono, cliente ativo), "Novo check-in".
 *
 * Com `podeCheckIn`, o WhatsApp abre já com a mensagem sugerida de estoque
 * no link; nada é registrado. Sem `podeCheckIn` (gestor, cliente inativo), o
 * link vai só com o número. O botão lista os contatos com telefone que serve
 * para o WhatsApp (com DDD, sem 0800 etc.), o
 * principal primeiro e depois por nome: com dois ou mais, abre um menu com
 * um link por contato; com um, é o link direto. O botão não depende do
 * "Ligar". Sem contato com telefone válido, usa o telefone do principal ou,
 * sem principal, o do cliente; se esse não serve, só "Ligar", e a proposta
 * nem é buscada. Sem telefone nenhum (cliente criado pelo gestor a partir
 * da nota, sem contato), nem "Ligar" nem WhatsApp; sem cidade, a linha
 * começa direto no representante. Com telefone de teste (`lib/telefone.ts`),
 * "Ligar" e WhatsApp vão para ele e uma linha avisa disso; o telefone
 * cadastrado continua na tela.
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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { usePropostaDeMensagem } from '../hooks/useMensagensEstoque';
import { useRepresentantes } from '../hooks/useRepresentantes';
import { descreverSituacao } from '../lib/descreverSituacao';
import { useDevolverFoco } from '../lib/useFoco';
import { contatosParaWhatsapp, textoSugeridoDoDestino } from '../lib/contatosWhatsapp';
import { linkLigar, linkWhatsapp, telefoneDeTeste } from '../lib/telefone';
import { mensagemErroApi, updateCliente, type ClienteCompleto, type Contato } from '../services/clients';
import type { Proposta } from '../services/stockMessages';
import { EtiquetaSituacao } from './EtiquetaSituacao';
import { Avatar, CLASSES_SELECT, Etiqueta } from './crm/ui';
import { NovoContato } from './crm/NovoContato';

const MENSAGEM_ERRO_TRANSFERIR = 'Não foi possível transferir o cliente.';

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

type DestinoWhatsapp = {
  chave: string;
  /** `null` no telefone do cliente, que não é um contato. */
  contactId: string | null;
  telefone: string;
  nome: string;
  cargo: string;
  principal: boolean;
};

/** Contatos com telefone que serve para o WhatsApp, o principal primeiro e depois por nome. */
function destinosWhatsapp(cliente: ClienteCompleto, contatoPrincipal: Contato | undefined): DestinoWhatsapp[] {
  const contatos = contatosParaWhatsapp(cliente.contatos).map((contato) => ({
    chave: contato.id,
    contactId: contato.id,
    telefone: contato.telefone,
    nome: contato.nome,
    cargo: contato.cargo,
    principal: contato.principal,
  }));
  if (contatos.length > 0) return contatos;

  const telefone = contatoPrincipal?.telefone ?? cliente.telefone;
  if (linkWhatsapp(telefone) === '') return [];
  return [{ chave: 'cliente', contactId: null, telefone, nome: '', cargo: '', principal: false }];
}

function rotuloDoDestino(destino: DestinoWhatsapp): string {
  return destino.cargo ? `${destino.nome} · ${destino.cargo}` : destino.nome;
}

function textoDoDestino(proposta: Proposta | undefined, destino: DestinoWhatsapp): string | undefined {
  return proposta ? textoSugeridoDoDestino(proposta, destino.contactId) : undefined;
}

/** Botão "WhatsApp": link direto com um destino, menu de contatos com vários. */
function BotaoWhatsapp({ destinos, proposta }: { destinos: DestinoWhatsapp[]; proposta: Proposta | undefined }) {
  const hrefDe = (destino: DestinoWhatsapp) => linkWhatsapp(destino.telefone, textoDoDestino(proposta, destino));

  if (destinos.length === 1) {
    return (
      <Button variant="outline" asChild>
        <a href={hrefDe(destinos[0])} target="_blank" rel="noopener noreferrer" aria-label="WhatsApp">
          <MessageCircle aria-hidden="true" />
          WhatsApp
        </a>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <MessageCircle aria-hidden="true" />
          WhatsApp
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {destinos.map((destino) => (
          <DropdownMenuItem key={destino.chave} asChild>
            <a href={hrefDe(destino)} target="_blank" rel="noopener noreferrer">
              {rotuloDoDestino(destino)}
              {destino.principal && (
                <>
                  {' '}
                  <span className="ml-1 text-xs text-muted-foreground">Principal</span>
                </>
              )}
            </a>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
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
      {/* Em telas estreitas o select encolhe (o nome fica cortado) em vez de
          passar da borda do cartão */}
      <span className="inline-flex max-w-full min-w-0 items-center gap-1">
        Rep.:
        <select
          aria-label="Transferir cliente"
          className={cn(CLASSES_SELECT, 'min-w-0 max-w-full')}
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
  const hrefLigar = linkLigar(telefone);
  const destinos = destinosWhatsapp(cliente, contatoPrincipal);
  const teste = telefoneDeTeste();
  const { data: proposta } = usePropostaDeMensagem(cliente.id, podeCheckIn && destinos.length > 0);

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
              {cliente.cidade && (
                <>
                  <span>{cliente.cidade}</span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              {podeTransferir ? (
                <TransferirCliente cliente={cliente} />
              ) : (
                <span>Rep.: {cliente.representante.nome}</span>
              )}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {cliente.ativo ? (
                <EtiquetaSituacao
                  cor={cliente.cor}
                  texto={descreverSituacao({
                    cor: cliente.cor,
                    diasSemVisita: cliente.diasSemVisita,
                    rebaixadoPorVenda: cliente.rebaixadoPorVenda,
                    diasSemCompra: cliente.diasSemCompra,
                  })}
                />
              ) : (
                <Etiqueta>Inativo</Etiqueta>
              )}
            </div>
            {hrefLigar && (
              <p className="text-sm">{contatoPrincipal ? `${contatoPrincipal.nome} · ${telefone}` : telefone}</p>
            )}
            {teste && (hrefLigar || destinos.length > 0) && (
              <p className="text-xs text-muted-foreground">Modo de teste: "Ligar" e WhatsApp vão para {teste}.</p>
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

        {(hrefLigar || destinos.length > 0 || podeCheckIn) && (
          <div className="grid grid-cols-2 gap-2 @md:flex @md:flex-wrap @2xl:shrink-0 @2xl:flex-nowrap">
            {hrefLigar && (
              <Button variant="outline" asChild>
                <a href={hrefLigar} aria-label="Ligar">
                  <Phone aria-hidden="true" />
                  Ligar
                </a>
              </Button>
            )}
            {destinos.length > 0 && <BotaoWhatsapp destinos={destinos} proposta={proposta} />}
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
