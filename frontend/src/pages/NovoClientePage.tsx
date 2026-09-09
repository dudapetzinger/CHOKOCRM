import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  createCliente,
  dadosClienteVazios,
  mensagemErroApi,
  normalizarDadosCliente,
  validarDadosCliente,
  type DadosClienteFormulario,
  type ErrosDadosCliente,
} from '../services/clients';
import {
  ContatoFields,
  contatoFormularioVazio,
  validarContatoFormulario,
  type ContatoFormValue,
} from '../components/ContatoFields';

const MENSAGEM_ERRO_PADRAO = 'Não foi possível cadastrar o cliente. Tente novamente.';
const MENSAGEM_ERRO_PRINCIPAL = 'Marque exatamente um contato como principal.';

export function NovoClientePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [dados, setDados] = useState<DadosClienteFormulario>(dadosClienteVazios());
  const [erros, setErros] = useState<ErrosDadosCliente>({});
  const [contatos, setContatos] = useState<ContatoFormValue[]>([contatoFormularioVazio(true)]);
  const [contatoErros, setContatoErros] = useState<(string | null)[]>([null]);
  const [erroPrincipal, setErroPrincipal] = useState<string | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: createCliente,
    onSuccess: (cliente) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      navigate(`/clientes/${cliente.id}`, { replace: true });
    },
    onError: (erro) => setErroEnvio(mensagemErroApi(erro, MENSAGEM_ERRO_PADRAO)),
  });

  function atualizarCampo<K extends keyof DadosClienteFormulario>(campo: K, valor: string): void {
    setDados((prev) => ({ ...prev, [campo]: valor }));
    setErros((prev) => ({ ...prev, [campo]: undefined }));
  }

  function atualizarContato(index: number, valor: ContatoFormValue): void {
    setContatos((prev) => prev.map((contato, i) => (i === index ? valor : contato)));
    setContatoErros((prev) => prev.map((erro, i) => (i === index ? null : erro)));
  }

  function selecionarPrincipal(index: number): void {
    setContatos((prev) => prev.map((contato, i) => ({ ...contato, principal: i === index })));
    setErroPrincipal(null);
  }

  function adicionarContato(): void {
    setContatos((prev) => [...prev, contatoFormularioVazio(false)]);
    setContatoErros((prev) => [...prev, null]);
  }

  function removerContato(index: number): void {
    setContatos((prev) => {
      if (prev.length <= 1) return prev;
      const removendoPrincipal = prev[index]!.principal;
      const restante = prev.filter((_, i) => i !== index);
      if (removendoPrincipal && restante.length > 0 && !restante.some((contato) => contato.principal)) {
        restante[0] = { ...restante[0]!, principal: true };
      }
      return restante;
    });
    setContatoErros((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    setErroEnvio(null);

    const errosDados = validarDadosCliente(dados);
    const errosContatos = contatos.map((contato) => validarContatoFormulario(contato));
    const totalPrincipais = contatos.filter((contato) => contato.principal).length;
    const erroPrincipalAtual = totalPrincipais === 1 ? null : MENSAGEM_ERRO_PRINCIPAL;

    setErros(errosDados);
    setContatoErros(errosContatos);
    setErroPrincipal(erroPrincipalAtual);

    const valido =
      Object.keys(errosDados).length === 0 && errosContatos.every((erro) => !erro) && !erroPrincipalAtual;
    if (!valido) return;

    mutation.mutate({
      ...normalizarDadosCliente(dados),
      contatos: contatos.map((contato) => ({
        nome: contato.nome.trim(),
        cargo: contato.cargo.trim(),
        telefone: contato.telefone.trim(),
        email: contato.email.trim(),
        principal: contato.principal,
      })),
    });
  }

  return (
    <div className="container">
      <header className="topo">
        <h1>Novo cliente</h1>
        <Link className="topo-acao" to="/clientes">
          Voltar
        </Link>
      </header>

      <div className="conteudo">
        <form onSubmit={handleSubmit} noValidate>
          {erroEnvio && (
            <p className="aviso aviso-atencao" role="alert">
              {erroEnvio}
            </p>
          )}

          <section className="card">
            <h2 className="card-titulo">Dados do cliente</h2>

            <div className="campo">
              <label htmlFor="razaoSocial">Razão social</label>
              <input
                type="text"
                id="razaoSocial"
                value={dados.razaoSocial}
                onChange={(event) => atualizarCampo('razaoSocial', event.target.value)}
              />
              {erros.razaoSocial && <p className="erro-campo">{erros.razaoSocial}</p>}
            </div>

            <div className="campo">
              <label htmlFor="nomeFantasia">Nome fantasia</label>
              <input
                type="text"
                id="nomeFantasia"
                value={dados.nomeFantasia}
                onChange={(event) => atualizarCampo('nomeFantasia', event.target.value)}
              />
              {erros.nomeFantasia && <p className="erro-campo">{erros.nomeFantasia}</p>}
            </div>

            <div className="campo">
              <label htmlFor="cnpj">CNPJ</label>
              <input
                type="text"
                id="cnpj"
                inputMode="numeric"
                placeholder="Somente números, 14 dígitos"
                value={dados.cnpj}
                onChange={(event) => atualizarCampo('cnpj', event.target.value.replace(/\D/g, ''))}
                maxLength={14}
              />
              {erros.cnpj && <p className="erro-campo">{erros.cnpj}</p>}
            </div>

            <div className="campo">
              <label htmlFor="cidade">Cidade</label>
              <input
                type="text"
                id="cidade"
                value={dados.cidade}
                onChange={(event) => atualizarCampo('cidade', event.target.value)}
              />
              {erros.cidade && <p className="erro-campo">{erros.cidade}</p>}
            </div>

            <div className="campo">
              <label htmlFor="endereco">Endereço</label>
              <input
                type="text"
                id="endereco"
                value={dados.endereco}
                onChange={(event) => atualizarCampo('endereco', event.target.value)}
              />
              {erros.endereco && <p className="erro-campo">{erros.endereco}</p>}
            </div>

            <div className="campo">
              <label htmlFor="telefone">Telefone</label>
              <input
                type="tel"
                id="telefone"
                value={dados.telefone}
                onChange={(event) => atualizarCampo('telefone', event.target.value)}
              />
              {erros.telefone && <p className="erro-campo">{erros.telefone}</p>}
            </div>

            <div className="campo">
              <label htmlFor="email">E-mail</label>
              <input
                type="email"
                id="email"
                value={dados.email}
                onChange={(event) => atualizarCampo('email', event.target.value)}
              />
              {erros.email && <p className="erro-campo">{erros.email}</p>}
            </div>

            <div className="campo">
              <label htmlFor="erpId">Identificador no ERP (opcional)</label>
              <input
                type="text"
                id="erpId"
                value={dados.erpId}
                onChange={(event) => atualizarCampo('erpId', event.target.value)}
              />
            </div>

            <div className="campo">
              <label htmlFor="recorrenciaDias">Recorrência de visitas em dias (opcional)</label>
              <input
                type="number"
                id="recorrenciaDias"
                min={1}
                max={365}
                placeholder="15"
                value={dados.recorrenciaDias}
                onChange={(event) => atualizarCampo('recorrenciaDias', event.target.value)}
              />
              <p className="campo-ajuda">Quando não informado, assume 15 dias.</p>
              {erros.recorrenciaDias && <p className="erro-campo">{erros.recorrenciaDias}</p>}
            </div>
          </section>

          <section className="card">
            <h2 className="card-titulo">Contatos</h2>

            {contatos.map((contato, index) => (
              <ContatoFields
                key={index}
                idPrefix={`novo-contato-${index}`}
                legenda={`Contato ${index + 1}`}
                value={contato}
                onChange={(valor) => atualizarContato(index, valor)}
                principalControl={{
                  tipo: 'radio',
                  name: 'novo-cliente-contato-principal',
                  onSelecionarPrincipal: () => selecionarPrincipal(index),
                }}
                onRemover={contatos.length > 1 ? () => removerContato(index) : undefined}
                removerDesabilitado={contatos.length <= 1}
                erro={contatoErros[index]}
              />
            ))}

            {erroPrincipal && (
              <p className="erro-campo" role="alert">
                {erroPrincipal}
              </p>
            )}

            <button type="button" className="btn-secundario" onClick={adicionarContato}>
              + Adicionar contato
            </button>
          </section>

          <button type="submit" className="btn-primario" disabled={mutation.isPending}>
            {mutation.isPending ? 'Cadastrando...' : 'Cadastrar cliente'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default NovoClientePage;
