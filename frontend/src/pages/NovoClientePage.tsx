/**
 * Cadastro de cliente (UC02), no visual do protótipo
 * (`routes/clientes.novo.tsx`, Etapa 8): um cartão de 560 px com razão
 * social, nome fantasia, CNPJ | cidade, endereço, telefone | e-mail, o
 * identificador no ERP (opcional, regra do app), a recorrência de visitas
 * (15, 20, 30 ou Outro; 15 por padrão, como no backend) e os contatos, com o
 * rádio "Contato principal", "Remover" e "Adicionar contato".
 *
 * Validações do app (as mesmas do zod do backend); o primeiro campo com erro
 * recebe o foco. Sucesso: aviso "Cliente cadastrado" e a ficha do cliente
 * criado. Só o representante cadastra (o cliente entra na carteira dele); o
 * gestor volta para a lista. Os campos não usam o preenchimento automático
 * do navegador: os dados são do cliente, não da representante.
 */
import { useState, type ComponentProps, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  createCliente,
  dadosClienteVazios,
  FAIXA_RECORRENCIA_SUGERIDA,
  mensagemErroApi,
  normalizarDadosCliente,
  validarDadosCliente,
  type CreateClienteInput,
  type DadosClienteFormulario,
  type ErrosDadosCliente,
} from '../services/clients';
import {
  ContatoFields,
  contatoFormularioVazio,
  validarContatoFormulario,
  type ContatoFormValue,
} from '../components/ContatoFields';
import { SeletorRecorrencia } from '../components/SeletorRecorrencia';
import { Aviso, Campo, Cartao } from '../components/crm/ui';
import { useAuth } from '../auth/useAuth';
import { useFocoNoPrimeiroErro } from '../lib/useFoco';

const MENSAGEM_ERRO_PADRAO = 'Não foi possível cadastrar o cliente. Tente novamente.';
const MENSAGEM_ERRO_PRINCIPAL = 'Marque exatamente um contato como principal.';
const MENSAGEM_ERRO_RECORRENCIA = 'Recorrência de visitas deve ser um número inteiro entre 1 e 365.';
/** Sem escolha, o backend assume 15 dias (`createClientSchema`). */
const RECORRENCIA_PADRAO = 15;

type CampoTexto = Exclude<keyof DadosClienteFormulario, 'recorrenciaDias'>;

function recorrenciaValida(dias: number): boolean {
  return Number.isInteger(dias) && dias >= 1 && dias <= 365;
}

export function NovoClientePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [dados, setDados] = useState<DadosClienteFormulario>(dadosClienteVazios());
  const [erros, setErros] = useState<ErrosDadosCliente>({});
  // Número vindo do SeletorRecorrencia; o campo "Outro" vazio chega como NaN
  const [recorrencia, setRecorrencia] = useState(RECORRENCIA_PADRAO);
  const [erroRecorrencia, setErroRecorrencia] = useState<string | null>(null);
  const [contatos, setContatos] = useState<ContatoFormValue[]>([contatoFormularioVazio(true)]);
  const [contatoErros, setContatoErros] = useState<(string | null)[]>([null]);
  const [erroPrincipal, setErroPrincipal] = useState<string | null>(null);
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const { ref: formulario, focarPrimeiroErro } = useFocoNoPrimeiroErro<HTMLFormElement>();

  const mutation = useMutation({
    mutationFn: (input: CreateClienteInput) => createCliente(input),
    onSuccess: (cliente) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Cliente cadastrado');
      navigate(`/clientes/${cliente.id}`, { replace: true });
    },
    onError: (erro) => setErroEnvio(mensagemErroApi(erro, MENSAGEM_ERRO_PADRAO)),
  });

  const foraDaFaixa =
    recorrenciaValida(recorrencia) &&
    (recorrencia < FAIXA_RECORRENCIA_SUGERIDA.min || recorrencia > FAIXA_RECORRENCIA_SUGERIDA.max);

  function atualizarCampo(campo: CampoTexto, valor: string): void {
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
    if (mutation.isPending) return;
    setErroEnvio(null);

    const errosDados = validarDadosCliente(dados);
    const erroRecorrenciaAtual = recorrenciaValida(recorrencia) ? null : MENSAGEM_ERRO_RECORRENCIA;
    const errosContatos = contatos.map((contato) => validarContatoFormulario(contato));
    const totalPrincipais = contatos.filter((contato) => contato.principal).length;
    const erroPrincipalAtual = totalPrincipais === 1 ? null : MENSAGEM_ERRO_PRINCIPAL;

    setErros(errosDados);
    setErroRecorrencia(erroRecorrenciaAtual);
    setContatoErros(errosContatos);
    setErroPrincipal(erroPrincipalAtual);

    const valido =
      Object.keys(errosDados).length === 0 &&
      !erroRecorrenciaAtual &&
      errosContatos.every((erro) => !erro) &&
      !erroPrincipalAtual;
    if (!valido) {
      focarPrimeiroErro();
      return;
    }

    mutation.mutate({
      ...normalizarDadosCliente(dados),
      recorrenciaDias: recorrencia,
      contatos: contatos.map((contato) => ({
        nome: contato.nome.trim(),
        cargo: contato.cargo.trim(),
        telefone: contato.telefone.trim(),
        email: contato.email.trim(),
        principal: contato.principal,
      })),
    });
  }

  if (user?.role !== 'REPRESENTANTE') {
    return <Navigate to="/clientes" replace />;
  }

  /** Um campo de texto dos dados do cliente: rótulo acima, erro abaixo. */
  function campoTexto(
    campo: CampoTexto,
    rotulo: string,
    props: Omit<ComponentProps<typeof Input>, 'id' | 'value' | 'onChange'> & { ajustar?: (valor: string) => string } = {},
  ) {
    const { ajustar, ...resto } = props;
    return (
      <Campo rotulo={rotulo} htmlFor={campo} erro={erros[campo]}>
        <Input
          type="text"
          {...resto}
          id={campo}
          autoComplete="off"
          value={dados[campo]}
          onChange={(event) => atualizarCampo(campo, ajustar ? ajustar(event.target.value) : event.target.value)}
        />
      </Campo>
    );
  }

  return (
    <Cartao className="mx-auto max-w-[560px]">
      <form ref={formulario} onSubmit={handleSubmit} noValidate autoComplete="off" className="space-y-4">
        {campoTexto('razaoSocial', 'Razão social')}
        {campoTexto('nomeFantasia', 'Nome fantasia')}
        <div className="grid gap-4 sm:grid-cols-2">
          {campoTexto('cnpj', 'CNPJ', {
            inputMode: 'numeric',
            maxLength: 14,
            // Curto para caber na coluna de 768 px (CNPJ | Cidade)
            placeholder: '14 dígitos, só números',
            ajustar: (valor) => valor.replace(/\D/g, ''),
          })}
          {campoTexto('cidade', 'Cidade')}
        </div>
        {campoTexto('endereco', 'Endereço')}
        <div className="grid gap-4 sm:grid-cols-2">
          {campoTexto('telefone', 'Telefone', { type: 'tel' })}
          {campoTexto('email', 'E-mail', { type: 'email' })}
        </div>
        {campoTexto('erpId', 'Identificador no ERP (opcional)')}

        <div className="space-y-1.5">
          {/* Aponta para o campo de "Outro"; os atalhos têm o nome do próprio grupo */}
          <label htmlFor="recorrenciaDias" className="block text-sm font-medium">
            Recorrência de visitas (dias)
          </label>
          <SeletorRecorrencia
            id="recorrenciaDias"
            valor={recorrencia}
            onChange={(dias) => {
              setRecorrencia(dias);
              setErroRecorrencia(null);
            }}
          />
          {foraDaFaixa && <Aviso tom="atencao">Valor fora da faixa sugerida de 15 a 30 dias.</Aviso>}
          {erroRecorrencia && (
            <p className="text-sm font-medium text-destructive" role="alert">
              {erroRecorrencia}
            </p>
          )}
        </div>

        <div className="space-y-3">
          <h2 className="text-sm font-medium">Contatos</h2>

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
            <p className="text-sm font-medium text-destructive" role="alert">
              {erroPrincipal}
            </p>
          )}

          <Button type="button" variant="outline" size="sm" onClick={adicionarContato}>
            <Plus aria-hidden="true" />
            Adicionar contato
          </Button>
        </div>

        {erroEnvio && (
          <Aviso tom="erro" role="alert">
            {erroEnvio}
          </Aviso>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" className="w-full sm:w-auto" disabled={mutation.isPending}>
            {mutation.isPending ? 'Salvando...' : 'Salvar cliente'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/clientes')}>
            Cancelar
          </Button>
        </div>
      </form>
    </Cartao>
  );
}

export default NovoClientePage;
