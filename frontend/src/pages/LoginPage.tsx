import { useState, type FormEvent } from 'react';
import { useLocation, useNavigate, type Path } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { ApiError } from '../services/api';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Campo } from '../components/crm/ui';
import { TelaPublica } from '../components/crm/TelaPublica';
import { ModoDemonstracao } from '../components/ModoDemonstracao';
import { rotaInicialDoPapel } from '../lib/rotaInicial';

const MENSAGEM_ERRO_PADRAO = 'Não foi possível entrar. Tente novamente.';

/**
 * Login no layout do protótipo: logotipo, slogan e cartão com
 * usuário, senha e "Entrar", sem dica de contas de teste. No topo, o
 * `ModoDemonstracao` (botão discreto, ou a faixa da data com "alterar"),
 * que a Gestão usa para recriar a demonstração. Depois de entrar,
 * volta para a tela que pediu o login (`RequireAuth` guarda em
 * `location.state.from`) ou vai para a tela inicial do papel.
 */
export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const origem = (location.state as { from?: Partial<Path> } | null)?.from;

  const [usuario, setUsuario] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      const conta = await login(usuario, senha);
      navigate(origem ?? rotaInicialDoPapel(conta.role), { replace: true });
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : MENSAGEM_ERRO_PADRAO);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <TelaPublica topo={<ModoDemonstracao />}>
      <section aria-labelledby="titulo-login" className="mt-6 w-full max-w-sm rounded-xl border bg-card p-6">
        <h1 id="titulo-login" className="sr-only">
          Entrar
        </h1>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Campo rotulo="Usuário" htmlFor="usuario">
            <Input
              type="text"
              id="usuario"
              name="usuario"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={usuario}
              onChange={(event) => setUsuario(event.target.value)}
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
