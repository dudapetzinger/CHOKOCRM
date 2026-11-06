import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { listClients, type ClienteListItem } from '../../services/clients';
import { SeletorDeClienteParaCheckIn } from './SeletorDeClienteParaCheckIn';

vi.mock('../../services/clients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/clients')>()),
  listClients: vi.fn(),
}));

function cliente(id: string, nomeFantasia: string, cidade: string, ativo = true): ClienteListItem {
  return {
    id,
    nomeFantasia,
    razaoSocial: `${nomeFantasia} Ltda`,
    cidade,
    telefone: '(47) 3333-4444',
    ativo,
    contatoPrincipal: null,
    cor: 'VERDE',
    diasSemVisita: 3,
    representante: { id: 'u1', nome: 'Eduarda Fischer' },
    rebaixadoPorVenda: false,
  };
}

const CARTEIRA: ClienteListItem[] = [
  cliente('c2', 'Padaria Estrela', 'Itajaí'),
  cliente('c1', 'Empório Pomerode', 'Pomerode'),
  cliente('c3', 'Doces da Vovó', 'Joinville'),
  cliente('c4', 'Café Antigo', 'Pomerode', false),
  cliente('c5', 'Confeitaria Central', 'São Bento do Sul'),
];

function TelaDeCheckIn() {
  const { id } = useParams();
  return <p>tela de check-in de {id}</p>;
}

function renderizar() {
  const aoFechar = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/agenda']}>
        <Routes>
          <Route path="/agenda" element={<SeletorDeClienteParaCheckIn representanteId="u1" aoFechar={aoFechar} />} />
          <Route path="/clientes/:id/check-in" element={<TelaDeCheckIn />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { aoFechar };
}

/** Nomes dos clientes na lista, na ordem (sem a cidade). */
async function nomesNaLista() {
  const lista = await screen.findByRole('list', { name: 'Clientes da carteira' });
  return within(lista)
    .getAllByRole('button')
    .map((botao) => botao.querySelector('[data-nome]')?.textContent);
}

afterEach(() => {
  vi.mocked(listClients).mockReset();
});

describe('SeletorDeClienteParaCheckIn', () => {
  it('painel "Para qual cliente?" com a carteira ativa do representante em ordem alfabética e o foco na busca', async () => {
    vi.mocked(listClients).mockResolvedValue(CARTEIRA);
    renderizar();

    const painel = screen.getByRole('dialog', { name: 'Para qual cliente?' });
    expect(painel).toHaveAttribute('aria-modal', 'true');
    expect(await nomesNaLista()).toEqual(['Confeitaria Central', 'Doces da Vovó', 'Empório Pomerode', 'Padaria Estrela']);
    expect(screen.queryByText('Café Antigo')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Buscar cliente')).toHaveFocus();
    expect(listClients).toHaveBeenCalledWith({ representanteId: 'u1' });
  });

  it('busca pelo nome sem acento: "pomer" acha o Empório Pomerode', async () => {
    vi.mocked(listClients).mockResolvedValue(CARTEIRA);
    const usuario = userEvent.setup({ delay: null });
    renderizar();
    await nomesNaLista();

    await usuario.type(screen.getByLabelText('Buscar cliente'), 'pomer');

    expect(await nomesNaLista()).toEqual(['Empório Pomerode']);
  });

  it('busca pela cidade, sem acento e sem diferenciar maiúsculas: "SAO BENTO" e "itajai"', async () => {
    vi.mocked(listClients).mockResolvedValue(CARTEIRA);
    const usuario = userEvent.setup({ delay: null });
    renderizar();
    await nomesNaLista();
    const busca = screen.getByLabelText('Buscar cliente');

    await usuario.type(busca, 'SAO BENTO');
    expect(await nomesNaLista()).toEqual(['Confeitaria Central']);

    await usuario.clear(busca);
    await usuario.type(busca, 'itajai');
    expect(await nomesNaLista()).toEqual(['Padaria Estrela']);
  });

  it('escolher um cliente vai para o check-in dele e fecha o painel', async () => {
    vi.mocked(listClients).mockResolvedValue(CARTEIRA);
    const usuario = userEvent.setup({ delay: null });
    const { aoFechar } = renderizar();

    await usuario.click(await screen.findByRole('button', { name: /Empório Pomerode/ }));

    expect(await screen.findByText('tela de check-in de c1')).toBeInTheDocument();
    expect(aoFechar).toHaveBeenCalledTimes(1);
    expect(aoFechar).toHaveBeenCalledWith({ devolverFoco: false });
  });

  it('carteira grande: mostra só 50 e avisa para refinar a busca', async () => {
    const grande = Array.from({ length: 60 }, (_, i) =>
      cliente(`g${i}`, `Cliente ${String(i).padStart(2, '0')}`, 'Blumenau'),
    );
    vi.mocked(listClients).mockResolvedValue(grande);
    const usuario = userEvent.setup({ delay: null });
    renderizar();

    expect(await nomesNaLista()).toHaveLength(50);
    expect(screen.getByText('Mostrando 50 de 60. Refine a busca.')).toBeInTheDocument();

    await usuario.type(screen.getByLabelText('Buscar cliente'), 'cliente 5');
    expect(await nomesNaLista()).toEqual([
      'Cliente 50',
      'Cliente 51',
      'Cliente 52',
      'Cliente 53',
      'Cliente 54',
      'Cliente 55',
      'Cliente 56',
      'Cliente 57',
      'Cliente 58',
      'Cliente 59',
    ]);
    expect(screen.queryByText(/Refine a busca/)).not.toBeInTheDocument();
  });

  it('nenhum resultado na busca: "Nenhum cliente encontrado."', async () => {
    vi.mocked(listClients).mockResolvedValue(CARTEIRA);
    const usuario = userEvent.setup({ delay: null });
    renderizar();
    await nomesNaLista();

    await usuario.type(screen.getByLabelText('Buscar cliente'), 'xyz');

    expect(screen.getByText('Nenhum cliente encontrado.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Clientes da carteira' })).not.toBeInTheDocument();
  });

  it('carteira vazia: "Nenhum cliente encontrado."', async () => {
    vi.mocked(listClients).mockResolvedValue([]);
    renderizar();

    expect(await screen.findByText('Nenhum cliente encontrado.')).toBeInTheDocument();
  });

  it('enquanto carrega, "Carregando clientes..."; com erro, o aviso', async () => {
    vi.mocked(listClients).mockRejectedValue(new Error('falhou'));
    renderizar();

    expect(screen.getByText('Carregando clientes...')).toBeInTheDocument();
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os clientes.');
  });

  it('Esc e o botão "Fechar" fecham devolvendo o foco', async () => {
    vi.mocked(listClients).mockResolvedValue(CARTEIRA);
    const usuario = userEvent.setup({ delay: null });
    const { aoFechar } = renderizar();
    await nomesNaLista();

    await usuario.keyboard('{Escape}');
    expect(aoFechar).toHaveBeenLastCalledWith({ devolverFoco: true });

    await usuario.click(screen.getByRole('button', { name: 'Fechar' }));
    expect(aoFechar).toHaveBeenCalledTimes(2);
    expect(aoFechar).toHaveBeenLastCalledWith({ devolverFoco: true });
  });

  it('o Tab fica dentro do painel: do último item volta ao primeiro controle, e o Shift+Tab faz o caminho inverso', async () => {
    vi.mocked(listClients).mockResolvedValue(CARTEIRA.slice(0, 1));
    const usuario = userEvent.setup({ delay: null });
    renderizar();
    const ultimo = await screen.findByRole('button', { name: /Padaria Estrela/ });

    ultimo.focus();
    await usuario.tab();
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveFocus();

    await usuario.tab({ shift: true });
    expect(ultimo).toHaveFocus();
  });
});
