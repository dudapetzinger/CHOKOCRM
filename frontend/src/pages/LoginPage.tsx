import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { ApiError } from '../services/api';

const MENSAGEM_ERRO_PADRAO = 'Não foi possível entrar. Tente novamente.';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setErro(null);
    setEnviando(true);

    try {
      await login(email, senha);
      navigate('/clientes', { replace: true });
    } catch (err) {
      setErro(err instanceof ApiError ? err.message : MENSAGEM_ERRO_PADRAO);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="container">
      <main className="tela-login">
        <div className="marca">
          <p className="marca-logo">
            Choko<span>CRM</span>
          </p>
          <p className="marca-slogan">Gestão de visitas para representantes comerciais</p>
        </div>

        <section className="card" aria-labelledby="titulo-login">
          <h1 id="titulo-login" className="card-titulo">
            Entrar
          </h1>

          {erro && (
            <p className="aviso aviso-atencao" role="alert">
              {erro}
            </p>
          )}

          <form onSubmit={handleSubmit} noValidate>
            <div className="campo">
              <label htmlFor="email">E-mail</label>
              <input
                type="email"
                id="email"
                name="email"
                placeholder="nome@chokolaten.com.br"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="campo">
              <label htmlFor="senha">Senha</label>
              <input
                type="password"
                id="senha"
                name="senha"
                placeholder="••••••••"
                autoComplete="current-password"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-primario" disabled={enviando}>
              {enviando ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

export default LoginPage;
