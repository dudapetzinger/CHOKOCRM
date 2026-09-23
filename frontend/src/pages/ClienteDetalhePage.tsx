import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  getCliente,
  updateCliente,
  createContato,
  updateContato,
  deleteContato,
  mensagemErroApi,
  normalizarDadosCliente,
  validarDadosCliente,
  dadosClienteVazios,
  type Contato,
  type DadosClienteFormulario,
  type ErrosDadosCliente,
} from '../services/clients';
import {
  ContatoFields,
  contatoFormularioVazio,
  validarContatoFormulario,
  type ContatoFormValue,
} from '../components/ContatoFields';
import { VisitTimeline } from '../components/VisitTimeline';
import { useAuth } from '../auth/useAuth';
import { useAnexarFotoVisita, useEditarDescricaoVisita, useVisitas } from '../hooks/useVisitas';
import { comprimirImagem } from '../lib/comprimirImagem';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar os dados do cliente.';
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

function formatarData(iso: string): string {
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR').format(data);
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

type ModoContato = { tipo: 'novo' } | { tipo: 'editar'; id: string };

export function ClienteDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const { data: visitas } = useVisitas(id);
  const mutationEditarDescricao = useEditarDescricaoVisita(id);
  const mutationAnexarFoto = useAnexarFotoVisita(id);

  const [modoEdicaoCliente, setModoEdicaoCliente] = useState(false);
  const [dadosEdicao, setDadosEdicao] = useState<DadosClienteFormulario>(dadosClienteVazios());
  const [errosEdicao, setErrosEdicao] = useState<ErrosDadosCliente>({});
  const [erroEdicaoEnvio, setErroEdicaoEnvio] = useState<string | null>(null);

  const [confirmandoInativacao, setConfirmandoInativacao] = useState(false);
  const [erroInativacaoEnvio, setErroInativacaoEnvio] = useState<string | null>(null);
  const [mensagemSucesso, setMensagemSucesso] = useState<string | null>(null);

  const [modoContato, setModoContato] = useState<ModoContato | null>(null);
  const [valorContato, setValorContato] = useState<ContatoFormValue>(contatoFormularioVazio(false));
  const [erroContatoValidacao, setErroContatoValidacao] = useState<string | null>(null);
  const [erroContatoEnvio, setErroContatoEnvio] = useState<string | null>(null);

  const [confirmandoRemocaoId, setConfirmandoRemocaoId] = useState<string | null>(null);
  const [erroAcaoContato, setErroAcaoContato] = useState<string | null>(null);

  const {
    data: cliente,
    isLoading,
    isError,
    error,
  } = useQuery({
    queryKey: ['client', id],
    queryFn: () => getCliente(id!),
    enabled: Boolean(id),
  });

  function invalidarCliente(): void {
    queryClient.invalidateQueries({ queryKey: ['client', id] });
    queryClient.invalidateQueries({ queryKey: ['clients'] });
  }

  const mutationEditar = useMutation({
    mutationFn: (input: ReturnType<typeof normalizarDadosCliente>) => updateCliente(id!, input),
    onSuccess: () => {
      invalidarCliente();
      setModoEdicaoCliente(false);
      setMensagemSucesso('Dados do cliente atualizados.');
    },
    onError: (erro) => setErroEdicaoEnvio(mensagemErroApi(erro, MENSAGEM_ERRO_SALVAR)),
  });

  const mutationInativar = useMutation({
    mutationFn: () => updateCliente(id!, { ativo: false }),
    onSuccess: () => {
      invalidarCliente();
      setConfirmandoInativacao(false);
      setMensagemSucesso('Cliente inativado. Ele não aparece mais na listagem padrão.');
    },
    onError: (erro) => setErroInativacaoEnvio(mensagemErroApi(erro, MENSAGEM_ERRO_INATIVAR)),
  });

  const mutationReativar = useMutation({
    mutationFn: () => updateCliente(id!, { ativo: true }),
    onSuccess: () => {
      invalidarCliente();
      setMensagemSucesso('Cliente reativado.');
    },
    onError: (erro) => setErroInativacaoEnvio(mensagemErroApi(erro, MENSAGEM_ERRO_REATIVAR)),
  });

  const mutationSalvarContato = useMutation({
    mutationFn: () => {
      const payload = {
        nome: valorContato.nome.trim(),
        cargo: valorContato.cargo.trim(),
        telefone: valorContato.telefone.trim(),
        email: valorContato.email.trim(),
        principal: valorContato.principal,
      };
      if (modoContato?.tipo === 'novo') return createContato(id!, payload);
      return updateContato(modoContato!.id, payload);
    },
    onSuccess: () => {
      invalidarCliente();
      setModoContato(null);
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
    if (!cliente) return;
    setDadosEdicao(dadosParaFormulario(cliente));
    setErrosEdicao({});
    setErroEdicaoEnvio(null);
    setMensagemSucesso(null);
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

    mutationEditar.mutate(normalizarDadosCliente(dadosEdicao));
  }

  function abrirNovoContato(): void {
    setModoContato({ tipo: 'novo' });
    setValorContato(contatoFormularioVazio(false));
    setErroContatoValidacao(null);
    setErroContatoEnvio(null);
    setMensagemSucesso(null);
  }

  function abrirEditarContato(contato: Contato): void {
    setModoContato({ tipo: 'editar', id: contato.id });
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
    setModoContato(null);
    setErroContatoValidacao(null);
    setErroContatoEnvio(null);
  }

  function handleSubmitContato(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setErroContatoEnvio(null);

    const erro = validarContatoFormulario(valorContato);
    setErroContatoValidacao(erro);
    if (erro) return;

    mutationSalvarContato.mutate();
  }

  if (isLoading) {
    return (
      <div className="container">
        <header className="topo">
          <h1>Cliente</h1>
          <Link className="topo-acao" to="/clientes">
            Voltar
          </Link>
        </header>
        <div className="conteudo">
          <p className="aviso">Carregando dados do cliente...</p>
        </div>
      </div>
    );
  }

  if (isError || !cliente) {
    return (
      <div className="container">
        <header className="topo">
          <h1>Cliente</h1>
          <Link className="topo-acao" to="/clientes">
            Voltar
          </Link>
        </header>
        <div className="conteudo">
          <p className="aviso aviso-atencao" role="alert">
            {mensagemErroApi(error, MENSAGEM_ERRO_CARREGAR)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <header className="topo">
        <h1>{cliente.nomeFantasia}</h1>
        <Link className="topo-acao" to="/clientes">
          Voltar
        </Link>
      </header>

      <div className="conteudo">
        {mensagemSucesso && <p className="aviso">{mensagemSucesso}</p>}

        <section className="card" aria-labelledby="titulo-dados-cliente">
          <h2 id="titulo-dados-cliente" className="card-titulo">
            Dados do cliente
          </h2>

          {!cliente.ativo && <p className="aviso aviso-atencao">Este cliente está inativo.</p>}

          {!modoEdicaoCliente && !confirmandoInativacao && (
            <>
              <p className="cliente-info">Razão social: {cliente.razaoSocial}</p>
              <p className="cliente-info">CNPJ: {formatarCnpj(cliente.cnpj)}</p>
              <p className="cliente-info">Cidade: {cliente.cidade}</p>
              <p className="cliente-info">Endereço: {cliente.endereco}</p>
              <p className="cliente-info">Telefone: {cliente.telefone}</p>
              <p className="cliente-info">E-mail: {cliente.email}</p>
              {cliente.erpId && <p className="cliente-info">Identificador no ERP: {cliente.erpId}</p>}
              <p className="cliente-info">Recorrência de visitas: a cada {cliente.recorrenciaDias} dias</p>
              <p className="cliente-info">Cliente desde: {formatarData(cliente.criadoEm)}</p>

              <div className="acoes-linha">
                <button type="button" className="btn-secundario" onClick={entrarModoEdicao}>
                  Editar dados
                </button>
                {cliente.ativo ? (
                  <button
                    type="button"
                    className="btn-secundario btn-perigo"
                    onClick={() => {
                      setErroInativacaoEnvio(null);
                      setMensagemSucesso(null);
                      setConfirmandoInativacao(true);
                    }}
                  >
                    Inativar cliente
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-secundario"
                    onClick={() => mutationReativar.mutate()}
                    disabled={mutationReativar.isPending}
                  >
                    {mutationReativar.isPending ? 'Reativando...' : 'Reativar cliente'}
                  </button>
                )}
              </div>
            </>
          )}

          {confirmandoInativacao && (
            <div className="confirmacao">
              {erroInativacaoEnvio && (
                <p className="aviso aviso-atencao" role="alert">
                  {erroInativacaoEnvio}
                </p>
              )}
              <p>
                Tem certeza que deseja inativar <strong>{cliente.nomeFantasia}</strong>? Ele deixará de
                aparecer na listagem padrão de clientes.
              </p>
              <div className="acoes-linha">
                <button
                  type="button"
                  className="btn-secundario"
                  onClick={() => setConfirmandoInativacao(false)}
                  disabled={mutationInativar.isPending}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className="btn-primario btn-perigo"
                  onClick={() => mutationInativar.mutate()}
                  disabled={mutationInativar.isPending}
                >
                  {mutationInativar.isPending ? 'Inativando...' : 'Confirmar inativação'}
                </button>
              </div>
            </div>
          )}

          {modoEdicaoCliente && (
            <form onSubmit={handleSubmitEdicao} noValidate>
              {erroEdicaoEnvio && (
                <p className="aviso aviso-atencao" role="alert">
                  {erroEdicaoEnvio}
                </p>
              )}

              <div className="campo">
                <label htmlFor="edicao-razaoSocial">Razão social</label>
                <input
                  type="text"
                  id="edicao-razaoSocial"
                  value={dadosEdicao.razaoSocial}
                  onChange={(event) => atualizarCampoEdicao('razaoSocial', event.target.value)}
                />
                {errosEdicao.razaoSocial && <p className="erro-campo">{errosEdicao.razaoSocial}</p>}
              </div>

              <div className="campo">
                <label htmlFor="edicao-nomeFantasia">Nome fantasia</label>
                <input
                  type="text"
                  id="edicao-nomeFantasia"
                  value={dadosEdicao.nomeFantasia}
                  onChange={(event) => atualizarCampoEdicao('nomeFantasia', event.target.value)}
                />
                {errosEdicao.nomeFantasia && <p className="erro-campo">{errosEdicao.nomeFantasia}</p>}
              </div>

              <div className="campo">
                <label htmlFor="edicao-cnpj">CNPJ</label>
                <input
                  type="text"
                  id="edicao-cnpj"
                  inputMode="numeric"
                  maxLength={14}
                  value={dadosEdicao.cnpj}
                  onChange={(event) => atualizarCampoEdicao('cnpj', event.target.value.replace(/\D/g, ''))}
                />
                {errosEdicao.cnpj && <p className="erro-campo">{errosEdicao.cnpj}</p>}
              </div>

              <div className="campo">
                <label htmlFor="edicao-cidade">Cidade</label>
                <input
                  type="text"
                  id="edicao-cidade"
                  value={dadosEdicao.cidade}
                  onChange={(event) => atualizarCampoEdicao('cidade', event.target.value)}
                />
                {errosEdicao.cidade && <p className="erro-campo">{errosEdicao.cidade}</p>}
              </div>

              <div className="campo">
                <label htmlFor="edicao-endereco">Endereço</label>
                <input
                  type="text"
                  id="edicao-endereco"
                  value={dadosEdicao.endereco}
                  onChange={(event) => atualizarCampoEdicao('endereco', event.target.value)}
                />
                {errosEdicao.endereco && <p className="erro-campo">{errosEdicao.endereco}</p>}
              </div>

              <div className="campo">
                <label htmlFor="edicao-telefone">Telefone</label>
                <input
                  type="tel"
                  id="edicao-telefone"
                  value={dadosEdicao.telefone}
                  onChange={(event) => atualizarCampoEdicao('telefone', event.target.value)}
                />
                {errosEdicao.telefone && <p className="erro-campo">{errosEdicao.telefone}</p>}
              </div>

              <div className="campo">
                <label htmlFor="edicao-email">E-mail</label>
                <input
                  type="email"
                  id="edicao-email"
                  value={dadosEdicao.email}
                  onChange={(event) => atualizarCampoEdicao('email', event.target.value)}
                />
                {errosEdicao.email && <p className="erro-campo">{errosEdicao.email}</p>}
              </div>

              <div className="campo">
                <label htmlFor="edicao-erpId">Identificador no ERP (opcional)</label>
                <input
                  type="text"
                  id="edicao-erpId"
                  value={dadosEdicao.erpId}
                  onChange={(event) => atualizarCampoEdicao('erpId', event.target.value)}
                />
              </div>

              <div className="campo">
                <label htmlFor="edicao-recorrenciaDias">Recorrência de visitas em dias</label>
                <input
                  type="number"
                  id="edicao-recorrenciaDias"
                  min={1}
                  max={365}
                  value={dadosEdicao.recorrenciaDias}
                  onChange={(event) => atualizarCampoEdicao('recorrenciaDias', event.target.value)}
                />
                {errosEdicao.recorrenciaDias && <p className="erro-campo">{errosEdicao.recorrenciaDias}</p>}
              </div>

              <div className="acoes-linha">
                <button
                  type="button"
                  className="btn-secundario"
                  onClick={cancelarEdicao}
                  disabled={mutationEditar.isPending}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primario" disabled={mutationEditar.isPending}>
                  {mutationEditar.isPending ? 'Salvando...' : 'Salvar alterações'}
                </button>
              </div>
            </form>
          )}
        </section>

        <section className="card" aria-labelledby="titulo-contatos">
          <h2 id="titulo-contatos" className="card-titulo">
            Contatos
          </h2>

          {erroAcaoContato && (
            <p className="aviso aviso-atencao" role="alert">
              {erroAcaoContato}
            </p>
          )}

          {cliente.contatos.map((contato) =>
            modoContato?.tipo === 'editar' && modoContato.id === contato.id ? (
              <form key={contato.id} onSubmit={handleSubmitContato} noValidate>
                {erroContatoEnvio && (
                  <p className="aviso aviso-atencao" role="alert">
                    {erroContatoEnvio}
                  </p>
                )}
                <ContatoFields
                  idPrefix={`editar-contato-${contato.id}`}
                  legenda="Editar contato"
                  value={valorContato}
                  onChange={setValorContato}
                  principalControl={{ tipo: 'checkbox' }}
                  erro={erroContatoValidacao}
                />
                <div className="acoes-linha">
                  <button
                    type="button"
                    className="btn-secundario"
                    onClick={fecharFormularioContato}
                    disabled={mutationSalvarContato.isPending}
                  >
                    Cancelar
                  </button>
                  <button type="submit" className="btn-primario" disabled={mutationSalvarContato.isPending}>
                    {mutationSalvarContato.isPending ? 'Salvando...' : 'Salvar contato'}
                  </button>
                </div>
              </form>
            ) : (
              <div className="contato" key={contato.id}>
                <p className="contato-nome">
                  <strong>{contato.nome}</strong>{' '}
                  {contato.principal && <span className="etiqueta">Principal</span>}
                </p>
                <p className="contato-cargo">{contato.cargo}</p>
                <p className="cliente-info">Telefone: {contato.telefone}</p>
                <p className="cliente-info">E-mail: {contato.email}</p>

                {confirmandoRemocaoId === contato.id ? (
                  <div className="confirmacao">
                    <p>
                      Remover o contato <strong>{contato.nome}</strong>?
                    </p>
                    <div className="acoes-linha">
                      <button
                        type="button"
                        className="btn-secundario"
                        onClick={() => setConfirmandoRemocaoId(null)}
                        disabled={mutationRemoverContato.isPending}
                      >
                        Cancelar
                      </button>
                      <button
                        type="button"
                        className="btn-primario btn-perigo"
                        onClick={() => mutationRemoverContato.mutate(contato.id)}
                        disabled={mutationRemoverContato.isPending}
                      >
                        {mutationRemoverContato.isPending ? 'Removendo...' : 'Confirmar remoção'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="acoes-linha">
                    <button type="button" className="btn-secundario" onClick={() => abrirEditarContato(contato)}>
                      Editar
                    </button>
                    {!contato.principal && (
                      <>
                        <button
                          type="button"
                          className="btn-secundario"
                          onClick={() => mutationPromoverContato.mutate(contato.id)}
                          disabled={mutationPromoverContato.isPending}
                        >
                          Tornar principal
                        </button>
                        <button
                          type="button"
                          className="btn-secundario btn-perigo"
                          onClick={() => setConfirmandoRemocaoId(contato.id)}
                        >
                          Remover
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            ),
          )}

          {modoContato?.tipo === 'novo' ? (
            <form onSubmit={handleSubmitContato} noValidate>
              {erroContatoEnvio && (
                <p className="aviso aviso-atencao" role="alert">
                  {erroContatoEnvio}
                </p>
              )}
              <ContatoFields
                idPrefix="novo-contato-cliente"
                legenda="Novo contato"
                value={valorContato}
                onChange={setValorContato}
                principalControl={{ tipo: 'checkbox' }}
                erro={erroContatoValidacao}
              />
              <div className="acoes-linha">
                <button
                  type="button"
                  className="btn-secundario"
                  onClick={fecharFormularioContato}
                  disabled={mutationSalvarContato.isPending}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn-primario" disabled={mutationSalvarContato.isPending}>
                  {mutationSalvarContato.isPending ? 'Salvando...' : 'Adicionar contato'}
                </button>
              </div>
            </form>
          ) : (
            <button type="button" className="btn-secundario" onClick={abrirNovoContato}>
              + Adicionar contato
            </button>
          )}
        </section>

        <section className="card" aria-labelledby="titulo-visitas">
          <h2 className="card-titulo" id="titulo-visitas">
            Histórico de visitas
          </h2>

          <Link className="btn-primario" to={`/clientes/${id}/check-in`}>
            Novo check-in
          </Link>

          <VisitTimeline
            visitas={visitas ?? []}
            usuarioId={user?.id}
            onEditarDescricao={async (visitaId, descricao) => {
              await mutationEditarDescricao.mutateAsync({ visitaId, descricao });
            }}
            onAnexarFoto={async (visitaId, arquivo) => {
              const comprimida = await comprimirImagem(arquivo);
              await mutationAnexarFoto.mutateAsync({ visitaId, foto: comprimida });
            }}
          />
        </section>
      </div>
    </div>
  );
}

export default ClienteDetalhePage;
