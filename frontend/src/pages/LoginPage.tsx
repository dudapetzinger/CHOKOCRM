import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, type Path } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { ApiError } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Campo } from '../components/crm/ui';
import { TelaPublica } from '../components/crm/TelaPublica';
import { rotaInicialDoPapel } from '../lib/rotaInicial';

const MENSAGEM_ERRO_PADRAO = 'Não foi possível entrar. Tente novamente.';

/**
 * Login no layout do protótipo (spec 7.14): logotipo, slogan e cartão com
 * e-mail, senha e "Entrar", sem dica de contas de teste. Depois de entrar,
 * volta para a tela que pediu o login (`RequireAuth` guarda em
 * `location.state.from`) ou vai para a tela inicial do papel.
 */
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const origem = (location.state as { from?: Partial<Path> } | null)?.from;

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      const usuario = await login(email, senha);
      navigate(origem ?? rotaInicialDoPapel(usuario.role), { replace: true });
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : MENSAGEM_ERRO_PADRAO);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <TelaPublica>
      <section aria-labelledby="titulo-login" className="mt-6 w-full max-w-sm rounded-xl border bg-card p-6">
        <h1 id="titulo-login" className="sr-only">
          Entrar
        </h1>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Campo rotulo="E-mail" htmlFor="email">
            <Input
              type="email"
              id="email"
              name="email"
              placeholder="nome@chokolaten.com.br"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Campo>

          <Campo rotulo="Senha" htmlFor="senha">
            <Input
              type="password"
              id="senha"
              name="senha"
              autoComplete="current-password"
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
              required
            />
          </Campo>

          {erro && (
            <p role="alert" className="text-sm text-destructive">
              {erro}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={enviando}>
            {enviando ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>
      </section>
    </TelaPublica>
  );
}

export default LoginPage;
