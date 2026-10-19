/**
 * Troca da própria senha (Etapa 8, spec 7.13), para todos os papéis, pelo
 * menu da conta; visual de `routes/senha.tsx` do protótipo (cartão de 480
 * px). Senha atual, nova (mínimo de 6) e confirmação. A senha atual errada
 * volta da API como 400 e aparece junto do campo "Senha atual". Sucesso:
 * aviso "Senha alterada" e a tela inicial do papel.
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '../auth/useAuth';
import { Aviso, Campo, Cartao } from '../components/crm/ui';
import { rotaInicialDoPapel } from '../lib/rotaInicial';
import { validarNovaSenha } from '../lib/senha';
import { useFocoNoPrimeiroErro } from '../lib/useFoco';
import { ApiError } from '../services/api';
import { mensagemErroApi } from '../services/clients';
import { alterarSenha } from '../services/conta';

const MENSAGEM_ERRO_PADRAO = 'Não foi possível alterar a senha. Tente novamente.';
const MENSAGEM_SENHA_ATUAL_VAZIA = 'Senha atual é obrigatória.';

type Dados = { senhaAtual: string; novaSenha: string; confirmacao: string };
type Erros = Partial<Record<keyof Dados, string>>;

/**
 * 400 sem detalhes do zod é a recusa da senha atual ("Senha atual
 * incorreta."); com detalhes, cada um vai para o campo dele.
 */
function errosDaApi(erro: unknown): Erros | null {
  if (!(erro instanceof ApiError) || erro.code !== 'VALIDATION_ERROR') return null;
  if (!Array.isArray(erro.details) || erro.details.length === 0) return { senhaAtual: erro.message };

  const erros: Erros = {};
  for (const detalhe of erro.details as { path?: unknown; message?: unknown }[]) {
    const mensagem = typeof detalhe?.message === 'string' ? detalhe.message : null;
    if (!mensagem) continue;
    if (detalhe.path === 'senhaAtual') erros.senhaAtual = mensagem;
    else if (detalhe.path === 'novaSenha') erros.novaSenha = mensagem;
  }
  return Object.keys(erros).length > 0 ? erros : null;
}

export function AlterarSenhaPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dados, setDados] = useState<Dados>({ senhaAtual: '', novaSenha: '', confirmacao: '' });
  const [erros, setErros] = useState<Erros>({});
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { ref: formulario, focarPrimeiroErro } = useFocoNoPrimeiroErro<HTMLFormElement>();

  if (!user) return null;
  const telaInicial = rotaInicialDoPapel(user.role);

  function atualizar(campo: keyof Dados, valor: string): void {
    setDados((anteriores) => ({ ...anteriores, [campo]: valor }));
    setErros((anteriores) => ({ ...anteriores, [campo]: undefined }));
  }

  async function enviar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    if (enviando) return;
    setErroEnvio(null);

    const { senha, confirmacao } = validarNovaSenha(dados.novaSenha, dados.confirmacao);
    const errosAtuais: Erros = {};
    if (!dados.senhaAtual) errosAtuais.senhaAtual = MENSAGEM_SENHA_ATUAL_VAZIA;
    if (senha) errosAtuais.novaSenha = senha;
    if (confirmacao) errosAtuais.confirmacao = confirmacao;
    setErros(errosAtuais);
    if (Object.keys(errosAtuais).length > 0) {
      focarPrimeiroErro();
      return;
    }

    setEnviando(true);
    try {
      await alterarSenha(dados.senhaAtual, dados.novaSenha);
      toast.success('Senha alterada');
      navigate(telaInicial, { replace: true });
    } catch (erro) {
      const porCampo = errosDaApi(erro);
      if (porCampo) {
        setErros(porCampo);
        focarPrimeiroErro();
      } else {
        setErroEnvio(mensagemErroApi(erro, MENSAGEM_ERRO_PADRAO));
      }
      setEnviando(false);
    }
  }

  return (
    <Cartao className="mx-auto max-w-[480px]">
      <form ref={formulario} onSubmit={enviar} noValidate className="space-y-4">
        {/* Para o gerenciador de senhas saber de qual conta é a senha nova */}
        <input type="email" name="username" autoComplete="username" value={user.email} readOnly hidden />

        <Campo rotulo="Senha atual" htmlFor="senha-atual" erro={erros.senhaAtual}>
          <Input
            id="senha-atual"
            type="password"
            autoComplete="current-password"
            value={dados.senhaAtual}
            onChange={(evento) => atualizar('senhaAtual', evento.target.value)}
          />
        </Campo>
        <Campo rotulo="Nova senha" htmlFor="nova-senha" ajuda="Pelo menos 6 caracteres." erro={erros.novaSenha}>
          <Input
            id="nova-senha"
            type="password"
            autoComplete="new-password"
            value={dados.novaSenha}
            onChange={(evento) => atualizar('novaSenha', evento.target.value)}
          />
        </Campo>
        <Campo rotulo="Confirmar nova senha" htmlFor="confirmar-senha" erro={erros.confirmacao}>
          <Input
            id="confirmar-senha"
            type="password"
            autoComplete="new-password"
            value={dados.confirmacao}
            onChange={(evento) => atualizar('confirmacao', evento.target.value)}
          />
        </Campo>

        {erroEnvio && (
          <Aviso tom="erro" role="alert">
            {erroEnvio}
          </Aviso>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" className="w-full sm:w-auto" disabled={enviando}>
            {enviando ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate(telaInicial)}>
            Cancelar
          </Button>
        </div>
      </form>
    </Cartao>
  );
}

export default AlterarSenhaPage;
