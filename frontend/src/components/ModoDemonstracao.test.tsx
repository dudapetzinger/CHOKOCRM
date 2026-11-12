import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { agora, definirDeslocamento } from '../lib/relogio';
import { ApiError } from '../services/api';
import { buscarRelogio, definirDemonstracao, type Relogio } from '../services/sistema';
import { Toaster } from './ui/sonner';
import { ModoDemonstracao } from './ModoDemonstracao';

vi.mock('../services/sistema', () => ({
  buscarRelogio: vi.fn(),
  definirDemonstracao: vi.fn(),
}));

const REAL: Relogio = {
  agora: '2026-11-09T15:00:00.000Z',
  simulado: false,
  dataDeDemonstracao: null,
  diaDeReferencia: null,
  deslocamentoDias: 0,
};
const SIMULADO: Relogio = {
  agora: '2027-03-15T15:00:00.000Z',
  simulado: true,
  dataDeDemonstracao: '2027-03-15',
  diaDeReferencia: '2026-11-09',
  deslocamentoDias: 126,
};
const AVISO =
  'Isto apaga os clientes da demonstração (com contatos, visitas, pedidos e lembretes), as campanhas e as metas e recria a demonstração nessa data. Os clientes reais (cadastrados à mão ou pela nota) e as contas de acesso são mantidos.';

let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  // Só o `Date` é falso: "hoje" real = 09/11/2026 em São Paulo.
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-11-09T15:00:00.000Z'));
  usuario = userEvent.setup({ delay: null });
  vi.mocked(buscarRelogio).mockReset().mockResolvedValue(REAL);
  // Como o backend: depois da recriação, GET /sistema/relogio devolve o relógio novo.
  vi.mocked(definirDemonstracao)
    .mockReset()
    .mockImplementation(async ({ data }) => {
      const relogio = data ? SIMULADO : REAL;
      vi.mocked(buscarRelogio).mockResolvedValue(relogio);
      return { relogio };
    });
});

afterEach(() => {
  vi.useRealTimers();
  definirDeslocamento(0);
});

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const espiaoInvalidar = vi.spyOn(queryClient, 'invalidateQueries');
  render(
    <QueryClientProvider client={queryClient}>
      <ModoDemonstracao />
      <Toaster />
    </QueryClientProvider>,
  );
  return { queryClient, espiaoInvalidar };
}

async function abrirPainel() {
  await usuario.click(await screen.findByRole('button', { name: 'Modo demonstração' }));
  return screen.getByRole('dialog', { name: 'Modo demonstração' });
}

async function preencherEAplicar(data: string | null, senha = 'segredo123') {
  const painel = screen.getByRole('dialog');
  const campoData = within(painel).getByLabelText('Data da demonstração');
  if (data === null) {
    await usuario.click(within(painel).getByRole('checkbox', { name: 'Voltar ao real' }));
  } else {
    await usuario.clear(campoData);
    await usuario.type(campoData, data);
  }
  await usuario.type(within(painel).getByLabelText('Senha da conta Gestão'), senha);
  await usuario.click(within(painel).getByRole('button', { name: 'Aplicar' }));
}

describe('ModoDemonstracao', () => {
  it('sem data ativa, mostra só o botão discreto "Modo demonstração", sem faixa', async () => {
    renderizar();

    expect(await screen.findByRole('button', { name: 'Modo demonstração' })).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('o painel abre com os textos exatos, a data de hoje, o e-mail da Gestão e o foco na data', async () => {
    renderizar();

    const painel = await abrirPainel();

    expect(painel).toHaveAttribute('aria-modal', 'true');
    expect(within(painel).getByRole('heading', { name: 'Modo demonstração' })).toBeInTheDocument();
    const campoData = within(painel).getByLabelText('Data da demonstração');
    expect(campoData).toHaveAttribute('type', 'date');
    expect(campoData).toHaveValue('2026-11-09');
    expect(campoData).toHaveFocus();
    expect(within(painel).getByRole('checkbox', { name: 'Voltar ao real' })).not.toBeChecked();
    expect(within(painel).getByText(AVISO)).toBeInTheDocument();
    const senha = within(painel).getByLabelText('Senha da conta Gestão');
    expect(senha).toHaveAttribute('type', 'password');
    expect(senha).toHaveAccessibleDescription(/gestao@chokolaten\.com\.br/);
    expect(within(painel).getByRole('button', { name: 'Aplicar' })).toBeEnabled();
    expect(within(painel).getByRole('button', { name: 'Cancelar' })).toBeEnabled();
  });

  it('"Aplicar" com data e senha chama definirDemonstracao com o e-mail da Gestão; toast, fecha e a faixa aparece', async () => {
    const { espiaoInvalidar } = renderizar();
    await abrirPainel();

    await preencherEAplicar('2027-03-15');

    expect(definirDemonstracao).toHaveBeenCalledWith({
      data: '2027-03-15',
      email: 'gestao@chokolaten.com.br',
      senha: 'segredo123',
    });
    expect(await screen.findByText('Demonstração recriada em 15/03/2027')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Modo demonstração · 15/03/2027');
    expect(screen.getByRole('button', { name: 'alterar' })).toHaveFocus();
    expect(espiaoInvalidar).toHaveBeenCalledWith({ queryKey: ['sistema', 'relogio'] });
    // O relógio do front já anda na data da demonstração.
    expect(agora().toISOString().slice(0, 10)).toBe('2027-03-15');
  });

  it('"Voltar ao real" manda data null e avisa "Modo demonstração desligado"', async () => {
    vi.mocked(buscarRelogio).mockResolvedValue(SIMULADO);
    renderizar();
    await usuario.click(await screen.findByRole('button', { name: 'alterar' }));
    expect(screen.getByLabelText('Data da demonstração')).toHaveValue('2027-03-15');

    await preencherEAplicar(null);

    expect(definirDemonstracao).toHaveBeenCalledWith({
      data: null,
      email: 'gestao@chokolaten.com.br',
      senha: 'segredo123',
    });
    expect(await screen.findByText('Modo demonstração desligado')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByText(/Modo demonstração ·/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modo demonstração' })).toBeInTheDocument();
    expect(agora().toISOString().slice(0, 10)).toBe('2026-11-09');
  });

  it('com "Voltar ao real" marcado, a data fica desabilitada', async () => {
    renderizar();
    const painel = await abrirPainel();

    await usuario.click(within(painel).getByRole('checkbox', { name: 'Voltar ao real' }));

    expect(within(painel).getByLabelText('Data da demonstração')).toBeDisabled();
  });

  it('durante a recriação mostra "Recriando a demonstração…" e desabilita os controles', async () => {
    let concluir: (valor: { relogio: Relogio }) => void = () => {};
    vi.mocked(definirDemonstracao).mockReturnValue(
      new Promise((resolver) => {
        concluir = resolver;
      }),
    );
    renderizar();
    const painel = await abrirPainel();

    await preencherEAplicar('2027-03-15');

    expect(await within(painel).findByRole('button', { name: 'Recriando a demonstração…' })).toBeDisabled();
    expect(within(painel).getByRole('button', { name: 'Cancelar' })).toBeDisabled();
    expect(within(painel).getByLabelText('Data da demonstração')).toBeDisabled();
    expect(within(painel).getByLabelText('Senha da conta Gestão')).toBeDisabled();
    expect(within(painel).getByRole('checkbox', { name: 'Voltar ao real' })).toBeDisabled();
    // Esc não fecha no meio da recriação.
    await usuario.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    concluir({ relogio: SIMULADO });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it.each([
    ['UNAUTHORIZED', 'E-mail ou senha inválidos'],
    ['FORBIDDEN', 'Só a conta Gestão pode fazer isso.'],
    ['CONFLICT', 'Já existe uma recriação em andamento.'],
  ])('erro %s mostra a mensagem da API no painel, que continua aberto', async (codigo, mensagem) => {
    vi.mocked(definirDemonstracao).mockRejectedValue(new ApiError(codigo, mensagem));
    renderizar();
    const painel = await abrirPainel();

    await preencherEAplicar('2027-03-15');

    expect(await within(painel).findByRole('alert')).toHaveTextContent(mensagem);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(within(painel).getByRole('button', { name: 'Aplicar' })).toBeEnabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('erro de validação (400) mostra a mensagem genérica', async () => {
    vi.mocked(definirDemonstracao).mockRejectedValue(
      new ApiError('VALIDATION_ERROR', 'Dados inválidos', [{ message: 'data inválida' }]),
    );
    renderizar();
    const painel = await abrirPainel();

    await preencherEAplicar('2027-03-15');

    expect(await within(painel).findByRole('alert')).toHaveTextContent(
      'Não foi possível recriar a demonstração. Confira a data e a senha.',
    );
  });

  it('sem senha não chama a API e pede a senha', async () => {
    renderizar();
    const painel = await abrirPainel();

    await usuario.click(within(painel).getByRole('button', { name: 'Aplicar' }));

    expect(definirDemonstracao).not.toHaveBeenCalled();
    expect(within(painel).getByRole('alert')).toHaveTextContent('Informe a senha da conta Gestão.');
  });

  it('Esc fecha o painel e o foco volta ao botão', async () => {
    renderizar();
    await abrirPainel();

    await usuario.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Modo demonstração' })).toHaveFocus();
  });

  it('"Cancelar" fecha sem chamar a API e o foco volta ao botão', async () => {
    renderizar();
    const painel = await abrirPainel();

    await usuario.click(within(painel).getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(definirDemonstracao).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Modo demonstração' })).toHaveFocus();
  });

  it('com data ativa, mostra a faixa com "alterar", que abre o mesmo painel', async () => {
    vi.mocked(buscarRelogio).mockResolvedValue(SIMULADO);
    renderizar();

    expect(await screen.findByText(/Modo demonstração · 15\/03\/2027/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Modo demonstração' })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'alterar' }));

    expect(screen.getByRole('dialog', { name: 'Modo demonstração' })).toBeInTheDocument();
  });
});
