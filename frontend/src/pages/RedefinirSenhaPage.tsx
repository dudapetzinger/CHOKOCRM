/**
 * Redefinição de senha pelo link do e-mail (Etapa 8, spec 7.13): página
 * pública, fora do `RequireAuth` e sem a moldura, com o logotipo como o
 * login. O link é `APP_URL/redefinir-senha#<token>`: o token vem no
 * fragmento, que o navegador não manda ao servidor nem no `Referer`. A página
 * o lê uma vez e o tira da barra de endereço. Nova senha (mínimo de 6) e
 * confirmação → "Senha redefinida. Entre com a nova senha." e o login. Link
 * ausente, inválido, usado ou vencido: "Este link não vale mais. Peça um
 * novo ao gestor."
 */
import { useEffect, useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Aviso, Campo } from '../components/crm/ui';
import { TelaPublica } from '../components/crm/TelaPublica';
import { validarNovaSenha, type ErrosNovaSenha } from '../lib/senha';
import { useFocoNoPrimeiroErro } from '../lib/useFoco';
import { ApiError } from '../services/api';
import { mensagemErroApi } from '../services/clients';
import { redefinirSenha } from '../services/conta';

const MENSAGEM_LINK_INVALIDO = 'Este link não vale mais. Peça um novo ao gestor.';
const MENSAGEM_ERRO_PADRAO = 'Não foi possível redefinir a senha. Tente novamente.';

/** O token do fragmento (`#…`), sem o `#`; o backend o manda codificado para URL. */
function lerToken(fragmento: string): string {
  const bruto = fragmento.replace(/^#/, '');
  try {
    return decodeURIComponent(bruto).trim();
  } catch {
    return bruto.trim();
  }
}

/** 400 sem detalhes do zod: o link não vale (o backend dá a mesma resposta para todos os casos). */
function ehLinkInvalido(erro: unknown): erro is ApiError {
  return (
    erro instanceof ApiError &&
    erro.code === 'VALIDATION_ERROR' &&
    !(Array.isArray(erro.details) && erro.details.length > 0)
  );
}

export function RedefinirSenhaPage() {
  const location = useLocation();
  const navigate = useNavigate();
  // Lido na montagem: logo depois o fragmento sai do endereço.
  const [token, setToken] = useState(() => lerToken(location.hash));
  const [linkInvalido, setLinkInvalido] = useState<string | null>(token ? null : MENSAGEM_LINK_INVALIDO);
  const [novaSenha, setNovaSenha] = useState('');
  const [confirmacao, setConfirmacao] = useState('');
  const [erros, setErros] = useState<ErrosNovaSenha>({});
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const { ref: formulario, focarPrimeiroErro } = useFocoNoPrimeiroErro<HTMLFormElement>();

  // Link novo colado nesta mesma aba: só o fragmento muda, a página não
  // recarrega. Vale o token novo, com o formulário limpo.
  const tokenNoEndereco = location.hash ? lerToken(location.hash) : '';
  if (tokenNoEndereco && tokenNoEndereco !== token) {
    setToken(tokenNoEndereco);
    setLinkInvalido(null);
    setErros({});
    setErroEnvio(null);
  }

  // O token não fica na barra de endereço (nem no histórico, nem em quem
  // olhar a tela) depois de lido.
  useEffect(() => {
    if (location.hash) {
      navigate({ pathname: location.pathname, search: location.search }, { replace: true });
    }
  }, [location.hash, location.pathname, location.search, navigate]);

  async function enviar(evento: FormEvent<HTMLFormElement>): Promise<void> {
    evento.preventDefault();
    if (enviando) return;
    setErroEnvio(null);

    const errosAtuais = validarNovaSenha(novaSenha, confirmacao);
    setErros(errosAtuais);
    if (Object.keys(errosAtuais).length > 0) {
      focarPrimeiroErro();
      return;
    }

    setEnviando(true);
    try {
      await redefinirSenha(token, novaSenha);
      toast.success('Senha redefinida. Entre com a nova senha.');
      navigate('/login', { replace: true });
    } catch (erro) {
      if (ehLinkInvalido(erro)) {
        setLinkInvalido(erro.message || MENSAGEM_LINK_INVALIDO);
      } else {
        setErroEnvio(mensagemErroApi(erro, MENSAGEM_ERRO_PADRAO));
      }
      setEnviando(false);
    }
  }

  return (
    <TelaPublica>
      <section aria-labelledby="titulo-redefinir" className="mt-6 w-full max-w-sm space-y-4 rounded-xl border bg-card p-6">
        <h1 id="titulo-redefinir" className="text-lg font-semibold">
          Redefinir senha
        </h1>

        {linkInvalido ? (
          <>
            <Aviso tom="erro" role="alert">
              {linkInvalido}
            </Aviso>
            <Button asChild className="w-full">
              <Link to="/login">Ir para o login</Link>
            </Button>
          </>
        ) : (
          <form ref={formulario} onSubmit={enviar} noValidate className="space-y-4">
            <p className="text-sm text-muted-foreground">Crie uma senha nova para entrar no ChokoCRM.</p>
            <Campo rotulo="Nova senha" htmlFor="nova-senha" ajuda="Pelo menos 6 caracteres." erro={erros.senha}>
              <Input
                id="nova-senha"
                type="password"
                autoComplete="new-password"
                value={novaSenha}
                onChange={(evento) => {
                  setNovaSenha(evento.target.value);
                  setErros((anteriores) => ({ ...anteriores, senha: undefined }));
                }}
              />
            </Campo>
            <Campo rotulo="Confirmar nova senha" htmlFor="confirmar-senha" erro={erros.confirmacao}>
              <Input
                id="confirmar-senha"
                type="password"
                autoComplete="new-password"
                value={confirmacao}
                onChange={(evento) => {
                  setConfirmacao(evento.target.value);
                  setErros((anteriores) => ({ ...anteriores, confirmacao: undefined }));
                }}
              />
            </Campo>

            {erroEnvio && (
              <Aviso tom="erro" role="alert">
                {erroEnvio}
              </Aviso>
            )}

            <Button type="submit" className="w-full" disabled={enviando}>
              {enviando ? 'Salvando...' : 'Redefinir senha'}
            </Button>
          </form>
        )}
      </section>
    </TelaPublica>
  );
}

export default RedefinirSenhaPage;
