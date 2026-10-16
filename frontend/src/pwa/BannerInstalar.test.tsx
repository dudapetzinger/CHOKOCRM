import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { AuthContext, type UsuarioAutenticado } from '../auth/auth-context';
import { removerSimulacaoDeLargura, simularLargura } from '../test/simularLargura';
import { BannerInstalar, CHAVE_INSTALAR_DISPENSADO } from './BannerInstalar';

const USUARIO: UsuarioAutenticado = {
  id: 'u1',
  nome: 'Ana Representante',
  email: 'ana@chokolaten.com.br',
  role: 'REPRESENTANTE',
};

const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/141.0 Mobile Safari/537.36';
const UA_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';

const DIA_MS = 24 * 60 * 60 * 1000;

function comUsuario(usuario: UsuarioAutenticado | null) {
  return function Provedor({ children }: { children: ReactNode }) {
    return (
      <AuthContext.Provider value={{ user: usuario, login: vi.fn(), logout: vi.fn() }}>{children}</AuthContext.Provider>
    );
  };
}

function renderizar(usuario: UsuarioAutenticado | null = USUARIO) {
  return render(<BannerInstalar />, { wrapper: comUsuario(usuario) });
}

/** O `beforeinstallprompt` do Chrome/Edge: cancelável, com `prompt()` e `userChoice`. */
function dispararPodeInstalar(resultado: 'accepted' | 'dismissed' = 'accepted') {
  const evento = Object.assign(new Event('beforeinstallprompt', { cancelable: true }), {
    prompt: vi.fn().mockResolvedValue(undefined),
    userChoice: Promise.resolve({ outcome: resultado, platform: 'web' }),
  });
  act(() => {
    window.dispatchEvent(evento);
  });
  return evento;
}

function simularUserAgent(ua: string) {
  vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(ua);
}

beforeEach(() => {
  localStorage.clear();
  simularUserAgent(UA_ANDROID);
});

afterEach(() => {
  vi.restoreAllMocks();
  removerSimulacaoDeLargura();
});

describe('BannerInstalar', () => {
  it('não aparece antes do beforeinstallprompt', () => {
    renderizar();

    expect(screen.queryByRole('button', { name: 'Instalar o ChokoCRM' })).not.toBeInTheDocument();
  });

  it('beforeinstallprompt → banner aparece (e o mini-infobar do navegador é suprimido)', () => {
    renderizar();

    const evento = dispararPodeInstalar();

    expect(evento.defaultPrevented).toBe(true);
    expect(screen.getByRole('button', { name: 'Instalar o ChokoCRM' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agora não' })).toBeInTheDocument();
  });

  it('"Instalar o ChokoCRM" abre o diálogo do navegador; depois do appinstalled o banner some', async () => {
    const usuario = userEvent.setup();
    renderizar();
    const evento = dispararPodeInstalar();

    await usuario.click(screen.getByRole('button', { name: 'Instalar o ChokoCRM' }));
    expect(evento.prompt).toHaveBeenCalledTimes(1);

    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(screen.queryByRole('button', { name: 'Instalar o ChokoCRM' })).not.toBeInTheDocument();
  });

  it('"Agora não" → some e grava a data na chave', async () => {
    const usuario = userEvent.setup();
    renderizar();
    dispararPodeInstalar();

    await usuario.click(screen.getByRole('button', { name: 'Agora não' }));

    expect(screen.queryByRole('button', { name: 'Instalar o ChokoCRM' })).not.toBeInTheDocument();
    const gravado = localStorage.getItem(CHAVE_INSTALAR_DISPENSADO);
    expect(CHAVE_INSTALAR_DISPENSADO).toBe('chokocrm:instalar-dispensado');
    expect(gravado).not.toBeNull();
    expect(new Date(gravado as string).toISOString()).toBe(gravado);
    expect(Date.now() - new Date(gravado as string).getTime()).toBeLessThan(60_000);
  });

  it('com a chave de 2 dias atrás → não aparece', () => {
    localStorage.setItem(CHAVE_INSTALAR_DISPENSADO, new Date(Date.now() - 2 * DIA_MS).toISOString());
    renderizar();

    dispararPodeInstalar();

    expect(screen.queryByRole('button', { name: 'Instalar o ChokoCRM' })).not.toBeInTheDocument();
  });

  it('com a chave de 31 dias atrás → aparece de novo', () => {
    localStorage.setItem(CHAVE_INSTALAR_DISPENSADO, new Date(Date.now() - 31 * DIA_MS).toISOString());
    renderizar();

    dispararPodeInstalar();

    expect(screen.getByRole('button', { name: 'Instalar o ChokoCRM' })).toBeInTheDocument();
  });

  it('localStorage indisponível não quebra: o banner aparece e "Agora não" esconde', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError');
    });
    const usuario = userEvent.setup();
    renderizar();
    dispararPodeInstalar();

    await usuario.click(screen.getByRole('button', { name: 'Agora não' }));

    expect(screen.queryByRole('button', { name: 'Instalar o ChokoCRM' })).not.toBeInTheDocument();
  });

  it('no iPhone (sem beforeinstallprompt) mostra a instrução do Safari', () => {
    simularUserAgent(UA_IPHONE);
    renderizar();

    expect(
      screen.getByText('No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início".'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Instalar o ChokoCRM' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Agora não' })).toBeInTheDocument();
  });

  it('já aberto como app instalado (display-mode standalone) → nunca aparece', () => {
    simularLargura(true); // toda consulta de mídia corresponde, inclusive (display-mode: standalone)
    simularUserAgent(UA_IPHONE);
    renderizar();

    dispararPodeInstalar();

    expect(screen.queryByRole('button', { name: 'Agora não' })).not.toBeInTheDocument();
    expect(window.matchMedia).toHaveBeenCalledWith('(display-mode: standalone)');
  });

  it('sem usuário logado → não aparece; o evento fica guardado e o banner surge depois do login', () => {
    const contexto = (usuario: UsuarioAutenticado | null) => ({ user: usuario, login: vi.fn(), logout: vi.fn() });
    const { rerender } = render(
      <AuthContext.Provider value={contexto(null)}>
        <BannerInstalar />
      </AuthContext.Provider>,
    );
    dispararPodeInstalar();
    expect(screen.queryByRole('button', { name: 'Instalar o ChokoCRM' })).not.toBeInTheDocument();

    rerender(
      <AuthContext.Provider value={contexto(USUARIO)}>
        <BannerInstalar />
      </AuthContext.Provider>,
    );
    expect(screen.getByRole('button', { name: 'Instalar o ChokoCRM' })).toBeInTheDocument();
  });
});
