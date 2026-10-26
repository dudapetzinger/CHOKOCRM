/**
 * Dados cadastrais da ficha do cliente (Etapa 7, spec 5.5): "Dados do
 * cliente" (com editar, inativar e reativar) e "Contatos" (listar, adicionar,
 * editar, tornar principal, remover). Etapa 9: são o conteúdo da aba
 * "Cadastro" da ficha, então os dois blocos aparecem direto, abertos, cada um
 * num cartão, um embaixo do outro (antes ficavam recolhidos num `<details>`).
 * A aba só monta quando está aberta, então uma edição em andamento se perde
 * ao trocar de aba.
 *
 * Etapa 8 (visual do protótipo, `Cadastro` de `crm/ficha.tsx`): os dados
 * numa lista rótulo | valor, os contatos numa lista com bordas, os avisos de
 * sucesso em `toast` (com os mesmos textos de antes) e o contato novo pelo
 * formulário em linha `NovoContato`, o mesmo do cabeçalho da ficha.
 */
import { useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  updateCliente,
  updateContato,
  deleteContato,
  mensagemErroApi,
  normalizarDadosEdicao,
  validarDadosCliente,
  dadosClienteVazios,
  type ClienteCompleto,
  type Contato,
  type DadosClienteFormulario,
  type ErrosDadosCliente,
} from '../services/clients';
import {
  ContatoFields,
  contatoFormularioVazio,
  validarContatoFormulario,
  type ContatoFormValue,
} from './ContatoFields';
import { formatarData } from '../lib/formatarData';
import { useDevolverFoco } from '../lib/useFoco';
import { Aviso, Campo, Cartao, CLASSES_BOTAO_PERIGO, Etiqueta } from './crm/ui';
import { NovoContato } from './crm/NovoContato';

const MENSAGEM_ERRO_SALVAR = 'Não foi possível salvar as alterações.';
const MENSAGEM_ERRO_INATIVAR = 'Não foi possível inativar o cliente.';
const MENSAGEM_ERRO_REATIVAR = 'Não foi possível reativar o cliente.';
const MENSAGEM_ERRO_CONTATO = 'Não foi possível salvar o contato.';
const MENSAGEM_ERRO_PROMOVER = 'Não foi possível promover o contato a principal.';
const MENSAGEM_ERRO_REMOVER = 'Não foi possível remover o contato.';

function formatarCnpj(cnpj: string): string {
  if (!/^\d{14}$/.test(cnpj)) return cnpj;
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

function formatarUltimaVisita(diasSemVisita: number | null): string {
  if (diasSemVisita === null) return 'Nunca visitado';
  if (diasSemVisita === 0) return 'Última visita hoje';
  if (diasSemVisita === 1) return 'Última visita há 1 dia';
  return `Última visita há ${diasSemVisita} dias`;
}

function dadosParaFormulario(cliente: {
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  cidade: string;
  endereco: string;
  telefone: string;
  email: string;
  erpId: string | null;
  recorrenciaDias: number;
}): DadosClienteFormulario {
  return {
    razaoSocial: cliente.razaoSocial,
    nomeFantasia: cliente.nomeFantasia,
    cnpj: cliente.cnpj,
    cidade: cliente.cidade,
    endereco: cliente.endereco,
    telefone: cliente.telefone,
    email: cliente.email,
    erpId: cliente.erpId ?? '',
    recorrenciaDias: String(cliente.recorrenciaDias),
  };
}

type CampoEditavel = Exclude<keyof DadosClienteFormulario, 'recorrenciaDias'>;

/** Campos do formulário "Editar dados", na ordem da tela (a recorrência tem cartão próprio). */
const CAMPOS_EDICAO: {
  campo: CampoEditavel;
  rotulo: string;
  tipo: 'text' | 'tel' | 'email';
  cnpj?: true;
}[] = [
  { campo: 'razaoSocial', rotulo: 'Razão social', tipo: 'text' },
  { campo: 'nomeFantasia', rotulo: 'Nome fantasia', tipo: 'text' },
  { campo: 'cnpj', rotulo: 'CNPJ', tipo: 'text', cnpj: true },
  { campo: 'cidade', rotulo: 'Cidade', tipo: 'text' },
  { campo: 'endereco', rotulo: 'Endereço', tipo: 'text' },
  { campo: 'telefone', rotulo: 'Telefone', tipo: 'tel' },
  { campo: 'email', rotulo: 'E-mail', tipo: 'email' },
  { campo: 'erpId', rotulo: 'Identificador no ERP (opcional)', tipo: 'text' },
];

type Props = {
  cliente: ClienteCompleto;
};

export function DadosCadastrais({ cliente }: Props) {
  const id = cliente.id;
  const queryClient = useQueryClient();

  const [modoEdicaoCliente, setModoEdicaoCliente] = useState(false);
  const [dadosEdicao, setDadosEdicao] = useState<DadosClienteFormulario>(dadosClienteVazios());
  const [errosEdicao, setErrosEdicao] = useState<ErrosDadosCliente>({});
  const [erroEdicaoEnvio, setErroEdicaoEnvio] = useState<string | null>(null);

  const [confirmandoInativacao, setConfirmandoInativacao] = useState(false);
  const [erroInativacaoEnvio, setErroInativacaoEnvio] = useState<string | null>(null);

  const [adicionandoContato, setAdicionandoContato] = useState(false);
  const { ref: botaoAdicionarContato, devolverFoco } = useDevolverFoco<HTMLButtonElement>(adicionandoContato);
  const [editandoContatoId, setEditandoContatoId] = useState<string | null>(null);
  const [valorContato, setValorContato] = useState<ContatoFormValue>(contatoFormularioVazio(false));
  const [erroContatoValidacao, setErroContatoValidacao] = useState<string | null>(null);
  const [erroContatoEnvio, setErroContatoEnvio] = useState<string | null>(null);

  const [confirmandoRemocaoId, setConfirmandoRemocaoId] = useState<string | null>(null);
  const [erroAcaoContato, setErroAcaoContato] = useState<string | null>(null);

  function invalidarCliente(): void {
    queryClient.invalidateQueries({ queryKey: ['client', id] });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  }

  const mutationEditar = useMutation({
    mutationFn: (input: ReturnType<typeof normalizarDadosEdicao>) => updateCliente(id, input),
    onSuccess: () => {
      invalidarCliente();
      setModoEdicaoCliente(false);
      toast.success('Dados do cliente atualizados.');
    },
    onError: (erro) => setErroEdicaoEnvio(mensagemErroApi(erro, MENSAGEM_ERRO_SALVAR)),
  });

  const mutationInativar = useMutation({
    mutationFn: () => updateCliente(id, { ativo: false }),
    onSuccess: () => {
      invalidarCliente();
      setConfirmandoInativacao(false);
      toast.success('Cliente inativado. Ele não aparece mais na listagem padrão.');
    },
    onError: (erro) => setErroInativacaoEnvio(mensagemErroApi(erro, MENSAGEM_ERRO_INATIVAR)),
  });

  const mutationReativar = useMutation({
    mutationFn: () => updateCliente(id, { ativo: true }),
    onSuccess: () => {
      invalidarCliente();
      setErroInativacaoEnvio(null);
      toast.success('Cliente reativado.');
    },
    onError: (erro) => setErroInativacaoEnvio(mensagemErroApi(erro, MENSAGEM_ERRO_REATIVAR)),
  });

  const mutationSalvarContato = useMutation({
    mutationFn: (contatoId: string) =>
      updateContato(contatoId, {
        nome: valorContato.nome.trim(),
        cargo: valorContato.cargo.trim(),
        telefone: valorContato.telefone.trim(),
        email: valorContato.email.trim(),
        principal: valorContato.principal,
      }),
    onSuccess: () => {
      invalidarCliente();
      setEditandoContatoId(null);
    },
    onError: (erro) => setErroContatoEnvio(mensagemErroApi(erro, MENSAGEM_ERRO_CONTATO)),
  });

  const mutationPromoverContato = useMutation({
    mutationFn: (contatoId: string) => updateContato(contatoId, { principal: true }),
    onSuccess: () => {
      setErroAcaoContato(null);
      invalidarCliente();
    },
    onError: (erro) => setErroAcaoContato(mensagemErroApi(erro, MENSAGEM_ERRO_PROMOVER)),
  });

  const mutationRemoverContato = useMutation({
    mutationFn: (contatoId: string) => deleteContato(contatoId),
    onSuccess: () => {
      setErroAcaoContato(null);
      setConfirmandoRemocaoId(null);
      invalidarCliente();
    },
    onError: (erro) => setErroAcaoContato(mensagemErroApi(erro, MENSAGEM_ERRO_REMOVER)),
  });

  function entrarModoEdicao(): void {
    setDadosEdicao(dadosParaFormulario(cliente));
    setErrosEdicao({});
    setErroEdicaoEnvio(null);
    setModoEdicaoCliente(true);
  }

  function cancelarEdicao(): void {
    setModoEdicaoCliente(false);
    setErrosEdicao({});
    setErroEdicaoEnvio(null);
  }

  function atualizarCampoEdicao<K extends keyof DadosClienteFormulario>(campo: K, valor: string): void {
    setDadosEdicao((prev) => ({ ...prev, [campo]: valor }));
    setErrosEdicao((prev) => ({ ...prev, [campo]: undefined }));
  }

  function handleSubmitEdicao(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setErroEdicaoEnvio(null);

    const erros = validarDadosCliente(dadosEdicao);
    setErrosEdicao(erros);
    if (Object.keys(erros).length > 0) return;

    mutationEditar.mutate(normalizarDadosEdicao(dadosEdicao));
  }

  function abrirEditarContato(contato: Contato): void {
    setAdicionandoContato(false);
    setEditandoContatoId(contato.id);
    setValorContato({
      nome: contato.nome,
      cargo: contato.cargo,
      telefone: contato.telefone,
      email: contato.email,
      principal: contato.principal,
    });
    setErroContatoValidacao(null);
    setErroContatoEnvio(null);
  }

  function fecharFormularioContato(): void {
    setEditandoContatoId(null);
    setErroContatoValidacao(null);
    setErroContatoEnvio(null);
  }

  function handleSubmitContato(event: FormEvent<HTMLFormElement>, contatoId: string): void {
    event.preventDefault();
    setErroContatoEnvio(null);

    const erro = validarContatoFormulario(valorContato);
    setErroContatoValidacao(erro);
    if (erro) return;

    mutationSalvarContato.mutate(contatoId);
  }

  const dados: [string, string][] = [
    ['Razão social', cliente.razaoSocial],
    ['CNPJ', formatarCnpj(cliente.cnpj)],
    ['Cidade', cliente.cidade],
    ['Endereço', cliente.endereco],
    ['Telefone', cliente.telefone],
    ['E-mail', cliente.email],
    ...(cliente.erpId ? ([['Identificador no ERP', cliente.erpId]] as [string, string][]) : []),
    ['Cliente desde', formatarData(cliente.criadoEm)],
  ];

  return (
    <div className="@container space-y-4">
      <Cartao titulo="Dados do cliente" className="space-y-3">
        <div className="space-y-1 text-sm text-muted-foreground">
          <p>{formatarUltimaVisita(cliente.diasSemVisita)}</p>
          {cliente.rebaixadoPorVenda && <p>Cor rebaixada: sem compra há {cliente.diasSemCompra} dias</p>}
        </div>

        {!cliente.ativo && <Aviso tom="atencao">Este cliente está inativo.</Aviso>}

        {!modoEdicaoCliente && !confirmandoInativacao && (
          <>
            <dl className="grid grid-cols-[minmax(0,1fr)] gap-x-4 gap-y-0.5 text-sm @sm:grid-cols-[8rem_minmax(0,1fr)] @sm:gap-y-2">
              {dados.map(([rotulo, valor]) => (
                <div key={rotulo} className="contents">
                  <dt className="text-muted-foreground">{rotulo}</dt>
                  <dd className="break-words @max-sm:mb-2">{valor}</dd>
                </div>
              ))}
            </dl>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={entrarModoEdicao}>
                Editar dados
              </Button>
              {cliente.ativo ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={CLASSES_BOTAO_PERIGO}
                  onClick={() => {
                    setErroInativacaoEnvio(null);
                    setConfirmandoInativacao(true);
                  }}
                >
                  Inativar cliente
                </Button>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setErroInativacaoEnvio(null);
                    mutationReativar.mutate();
                  }}
                  disabled={mutationReativar.isPending}
                >
                  {mutationReativar.isPending ? 'Reativando...' : 'Reativar cliente'}
                </Button>
              )}
            </div>
            {!confirmandoInativacao && erroInativacaoEnvio && (
              <Aviso tom="erro" role="alert">
                {erroInativacaoEnvio}
              </Aviso>
            )}
          </>
        )}

        {confirmandoInativacao && (
          <div className="space-y-3 rounded-lg border p-3 text-sm">
            {erroInativacaoEnvio && (
              <Aviso tom="erro" role="alert">
                {erroInativacaoEnvio}
              </Aviso>
            )}
            <p>
              Tem certeza que deseja inativar <strong>{cliente.nomeFantasia}</strong>? Ele deixará de aparecer na
              listagem padrão de clientes.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => {
                  setConfirmandoInativacao(false);
                  setErroInativacaoEnvio(null);
                }}
                disabled={mutationInativar.isPending}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                variant="destructive"
                onClick={() => mutationInativar.mutate()}
                disabled={mutationInativar.isPending}
              >
                {mutationInativar.isPending ? 'Inativando...' : 'Confirmar inativação'}
              </Button>
            </div>
          </div>
        )}

        {modoEdicaoCliente && (
          <form onSubmit={handleSubmitEdicao} noValidate className="space-y-4">
            {erroEdicaoEnvio && (
              <Aviso tom="erro" role="alert">
                {erroEdicaoEnvio}
              </Aviso>
            )}

            <div className="grid gap-3 @md:grid-cols-2">
              {CAMPOS_EDICAO.map(({ campo, rotulo, tipo, cnpj }) => (
                <Campo key={campo} rotulo={rotulo} htmlFor={`edicao-${campo}`} erro={errosEdicao[campo]}>
                  <Input
                    type={tipo}
                    id={`edicao-${campo}`}
                    inputMode={cnpj ? 'numeric' : undefined}
                    maxLength={cnpj ? 14 : undefined}
                    value={dadosEdicao[campo]}
                    onChange={(event) =>
                      atualizarCampoEdicao(campo, cnpj ? event.target.value.replace(/\D/g, '') : event.target.value)
                    }
                  />
                </Campo>
              ))}
            </div>

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <Button type="button" variant="outline" onClick={cancelarEdicao} disabled={mutationEditar.isPending}>
                Cancelar
              </Button>
              <Button type="submit" disabled={mutationEditar.isPending}>
                {mutationEditar.isPending ? 'Salvando...' : 'Salvar alterações'}
              </Button>
            </div>
          </form>
        )}
      </Cartao>

      <Cartao titulo="Contatos" className="space-y-3">
        {erroAcaoContato && (
          <Aviso tom="erro" role="alert">
            {erroAcaoContato}
          </Aviso>
        )}

        {cliente.contatos.length > 0 && (
          <ul className="divide-y rounded-lg border text-sm">
            {cliente.contatos.map((contato) =>
              editandoContatoId === contato.id ? (
                <li key={contato.id} className="p-3">
                  <form onSubmit={(event) => handleSubmitContato(event, contato.id)} noValidate className="space-y-3">
                    {erroContatoEnvio && (
                      <Aviso tom="erro" role="alert">
                        {erroContatoEnvio}
                      </Aviso>
                    )}
                    <ContatoFields
                      idPrefix={`editar-contato-${contato.id}`}
                      legenda="Editar contato"
                      value={valorContato}
                      onChange={setValorContato}
                      principalControl={{ tipo: 'checkbox' }}
                      erro={erroContatoValidacao}
                    />
                    <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={fecharFormularioContato}
                        disabled={mutationSalvarContato.isPending}
                      >
                        Cancelar
                      </Button>
                      <Button type="submit" size="sm" disabled={mutationSalvarContato.isPending}>
                        {mutationSalvarContato.isPending ? 'Salvando...' : 'Salvar contato'}
                      </Button>
                    </div>
                  </form>
                </li>
              ) : (
                <li key={contato.id} className="space-y-2 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span>
                      <b className="font-medium">{contato.nome}</b> · {contato.cargo}
                    </span>
                    <span className="flex items-center gap-2 text-muted-foreground">
                      {contato.telefone}
                      {contato.principal && <Etiqueta tom="laranja">Principal</Etiqueta>}
                    </span>
                  </div>
                  <p className="break-words text-muted-foreground">{contato.email}</p>

                  {confirmandoRemocaoId === contato.id ? (
                    <div className="space-y-2">
                      <p>
                        Remover o contato <strong>{contato.nome}</strong>?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmandoRemocaoId(null)}
                          disabled={mutationRemoverContato.isPending}
                        >
                          Cancelar
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="destructive"
                          onClick={() => mutationRemoverContato.mutate(contato.id)}
                          disabled={mutationRemoverContato.isPending}
                        >
                          {mutationRemoverContato.isPending ? 'Removendo...' : 'Confirmar remoção'}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" variant="outline" onClick={() => abrirEditarContato(contato)}>
                        Editar
                      </Button>
                      {!contato.principal && (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => mutationPromoverContato.mutate(contato.id)}
                            disabled={mutationPromoverContato.isPending}
                          >
                            Tornar principal
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className={CLASSES_BOTAO_PERIGO}
                            onClick={() => setConfirmandoRemocaoId(contato.id)}
                          >
                            Remover
                          </Button>
                        </>
                      )}
                    </div>
                  )}
                </li>
              ),
            )}
          </ul>
        )}

        {adicionandoContato ? (
          <NovoContato
            clienteId={id}
            aoConcluir={() => {
              devolverFoco();
              setAdicionandoContato(false);
            }}
          />
        ) : (
          <Button
            ref={botaoAdicionarContato}
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              fecharFormularioContato();
              setAdicionandoContato(true);
            }}
          >
            <Plus aria-hidden="true" />
            Adicionar contato
          </Button>
        )}
      </Cartao>
    </div>
  );
}
