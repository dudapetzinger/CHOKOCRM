import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { AuthContext, type Role } from '../../auth/auth-context';
import { buscarCalendario, type ItemCalendario } from '../../services/agenda';
import { Calendario } from './Calendario';

vi.mock('../../services/agenda', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/agenda')>()),
  buscarCalendario: vi.fn(),
}));

const VISITA_MARCADA: ItemCalendario = {
  data: '2026-10-22',
  tipo: 'VISITA',
  titulo: 'Empório Central',
  clienteId: 'c1',
  representante: { id: 'u1', nome: 'Eduarda Fischer' },
  campanha: { id: 'cp1', nome: 'Natal Chokolaten' },
};

const VISITA_MARCADA_VENCIDA: ItemCalendario = {
  data: '2026-10-19',
  tipo: 'VISITA',
  titulo: 'Doces da Vovó',
  clienteId: 'c2',
  representante: { id: 'u1', nome: 'Eduarda Fischer' },
  campanha: null,
  detalhe: 'Visita marcada venceu há 2 dias',
};

const LEMBRETE: ItemCalendario = {
  data: '2026-10-21',
  tipo: 'LEMBRETE',
  titulo: 'Padaria Doce Sabor',
  clienteId: 'c3',
  lembreteId: 'l1',
  texto: 'Levar amostras do Natal',
  representante: { id: 'u1', nome: 'Eduarda Fischer' },
};

const LEMBRETE_VENCIDO: ItemCalendario = {
  ...LEMBRETE,
  data: '2026-10-19',
  detalhe: 'Lembrete venceu há 3 dias',
};

const SAZONAL: ItemCalendario = {
  data: '2026-10-12',
  tipo: 'DATA_SAZONAL',
  titulo: 'Dia das Crianças',
  detalhe: 'Data sazonal',
};

const CAMPANHA: ItemCalendario = {
  data: '2026-10-22',
  tipo: 'CAMPANHA',
  titulo: 'Natal Chokolaten',
  campanha: { id: 'cp1', nome: 'Natal Chokolaten' },
  detalhe: 'Campanha · 20/10/2026 a 24/12/2026',
};

function FichaFalsa() {
  const { id } = useParams();
  return <p>Ficha do cliente {id}</p>;
}

function renderizar(role: Role = 'REPRESENTANTE', itens: ItemCalendario[] = [VISITA_MARCADA, VISITA_MARCADA_VENCIDA, LEMBRETE, SAZONAL]) {
  vi.mocked(buscarCalendario).mockImplementation(async (mes) => ({ mes, itens: mes === '2026-10' ? itens : [] }));
  const auth = {
    user: { id: 'u1', nome: 'Usuário', email: 'usuario@exemplo.com', role, telefone: null, ativo: true },
    login: vi.fn(),
    logout: vi.fn(),
    recarregarUsuario: vi.fn(async () => {}),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/agenda']}>
          <Routes>
            <Route path="/agenda" element={<Calendario />} />
            <Route path="/clientes/:id" element={<FichaFalsa />} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

/** O painel do dia: a região com o nome do dia selecionado. */
function painelDoDia(nome: string | RegExp) {
  return screen.getByRole('region', { name: nome });
}

let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-19T15:00:00Z'));
  usuario = userEvent.setup({ delay: null });
  vi.mocked(buscarCalendario).mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Calendario', () => {
  it('abre no mês de hoje, com hoje selecionado e marcado como a data atual', async () => {
    renderizar();

    expect(screen.getByRole('heading', { name: 'Outubro de 2026' })).toBeInTheDocument();
    const hoje = await screen.findByRole('button', { name: 'segunda-feira, 19 de outubro, 1 item' });
    expect(hoje).toHaveAttribute('aria-current', 'date');
    expect(hoje).toHaveAttribute('aria-pressed', 'true');
    expect(buscarCalendario).toHaveBeenCalledWith('2026-10', undefined);
    expect(within(painelDoDia('segunda-feira, 19 de outubro')).getByText('Doces da Vovó')).toBeInTheDocument();
  });

  it('a grade tem 42 dias, de domingo 27/09 a sábado 07/11', async () => {
    renderizar();

    await screen.findByRole('button', { name: /^quinta-feira, 22 de outubro/ });
    const dias = screen.getAllByRole('button', { name: /-feira|sábado|domingo/ });
    expect(dias).toHaveLength(42);
    expect(dias[0]).toHaveAccessibleName(/^domingo, 27 de setembro/);
    expect(dias[41]).toHaveAccessibleName(/^sábado, 7 de novembro/);
  });

  it('clicar num dia mostra a lista do dia, com a visita marcada e a campanha', async () => {
    renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'quinta-feira, 22 de outubro, 1 item' }));

    const painel = painelDoDia('quinta-feira, 22 de outubro');
    expect(within(painel).getByText('Empório Central')).toBeInTheDocument();
    expect(within(painel).getByText('Visita marcada')).toBeInTheDocument();
    expect(within(painel).queryByText(/venceu/)).not.toBeInTheDocument();
    expect(within(painel).getByText('Natal Chokolaten')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'quinta-feira, 22 de outubro, 1 item' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('a visita marcada que já passou fica no dia marcado e diz quando venceu', async () => {
    renderizar();

    await screen.findByRole('button', { name: 'segunda-feira, 19 de outubro, 1 item' });
    const painel = painelDoDia('segunda-feira, 19 de outubro');
    expect(within(painel).getByText('Visita marcada')).toBeInTheDocument();
    expect(within(painel).getByText('Doces da Vovó')).toBeInTheDocument();
    expect(within(painel).getByText('Visita marcada venceu há 2 dias')).toBeInTheDocument();
  });

  it('o lembrete aparece no dia dele, com o cliente, o texto e a ficha', async () => {
    renderizar();

    const dia = await screen.findByRole('button', { name: 'quarta-feira, 21 de outubro, 1 item' });
    expect(within(dia).getByText('Padaria Doce Sabor')).toBeInTheDocument();
    await usuario.click(dia);

    const painel = painelDoDia('quarta-feira, 21 de outubro');
    expect(within(painel).getByText('Lembrete')).toBeInTheDocument();
    expect(within(painel).getByText('Padaria Doce Sabor')).toBeInTheDocument();
    expect(within(painel).getByText('Levar amostras do Natal')).toBeInTheDocument();
    expect(within(painel).queryByText(/venceu/)).not.toBeInTheDocument();
    expect(within(painel).queryByText(/^Rep\.:/)).not.toBeInTheDocument();
    expect(within(painel).queryByRole('button', { name: /Concluir/ })).not.toBeInTheDocument();
    expect(within(painel).getByRole('link', { name: /Padaria Doce Sabor/ })).toHaveAttribute('href', '/clientes/c3');
    await usuario.click(within(painel).getByRole('link', { name: /Levar amostras do Natal/ }));
    expect(screen.getByText('Ficha do cliente c3')).toBeInTheDocument();
  });

  it('o lembrete vencido fica no dia dele e diz quando venceu; o gestor vê de quem é', async () => {
    renderizar('GESTOR', [LEMBRETE_VENCIDO]);

    await usuario.click(await screen.findByRole('button', { name: 'segunda-feira, 19 de outubro, 1 item' }));

    const painel = painelDoDia('segunda-feira, 19 de outubro');
    expect(within(painel).getByText('Lembrete venceu há 3 dias')).toBeInTheDocument();
    expect(within(painel).getByText('Rep.: Eduarda Fischer')).toBeInTheDocument();
  });

  it('visita e lembrete do mesmo cliente no mesmo dia aparecem os dois, sem chave repetida', async () => {
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderizar('REPRESENTANTE', [
      { ...VISITA_MARCADA, clienteId: 'c3', titulo: 'Padaria Doce Sabor', campanha: null },
      { ...LEMBRETE, data: '2026-10-22' },
    ]);

    await usuario.click(await screen.findByRole('button', { name: 'quinta-feira, 22 de outubro, 2 itens' }));

    const painel = painelDoDia('quinta-feira, 22 de outubro');
    expect(within(painel).getAllByRole('link')).toHaveLength(2);
    expect(within(painel).getByText('Visita marcada')).toBeInTheDocument();
    expect(within(painel).getByText('Lembrete')).toBeInTheDocument();
    expect(erro).not.toHaveBeenCalled();
    erro.mockRestore();
  });

  it('no celular, o lembrete vira um ponto amarelo (o tom forte, 3:1 sobre o cartão) e a visita marcada, um ponto da cor primária', async () => {
    renderizar();

    const comLembrete = await screen.findByRole('button', { name: 'quarta-feira, 21 de outubro, 1 item' });
    expect(comLembrete.querySelector('.sm\\:hidden .bg-st-yellow-forte')).not.toBeNull();
    expect(comLembrete.querySelector('.sm\\:hidden .bg-primary')).toBeNull();
    const comVisita = screen.getByRole('button', { name: 'quinta-feira, 22 de outubro, 1 item' });
    expect(comVisita.querySelector('.sm\\:hidden .bg-primary')).not.toBeNull();
    expect(comVisita.querySelector('.sm\\:hidden .bg-st-yellow-forte')).toBeNull();
  });

  it('dia sem itens diz que não há nada', async () => {
    renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'terça-feira, 20 de outubro, nenhum item' }));

    expect(within(painelDoDia('terça-feira, 20 de outubro')).getByText('Nada neste dia.')).toBeInTheDocument();
  });

  it('item de cliente leva à ficha do cliente', async () => {
    renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'quinta-feira, 22 de outubro, 1 item' }));
    await usuario.click(within(painelDoDia('quinta-feira, 22 de outubro')).getByRole('link', { name: /Empório Central/ }));

    expect(screen.getByText('Ficha do cliente c1')).toBeInTheDocument();
  });

  it('data sazonal aparece no dia, sem link', async () => {
    renderizar();

    await usuario.click(await screen.findByRole('button', { name: 'segunda-feira, 12 de outubro, 1 item' }));

    const painel = painelDoDia('segunda-feira, 12 de outubro');
    expect(within(painel).getByText('Dia das Crianças')).toBeInTheDocument();
    expect(within(painel).queryByRole('link')).not.toBeInTheDocument();
  });

  it('com mais de 3 itens no dia, a célula mostra os 3 primeiros e "+N"', async () => {
    const muitos = Array.from({ length: 5 }, (_, i) => ({ ...VISITA_MARCADA, clienteId: `c${i}`, titulo: `Cliente ${i}` }));
    renderizar('REPRESENTANTE', muitos);

    const dia = await screen.findByRole('button', { name: 'quinta-feira, 22 de outubro, 5 itens' });
    expect(within(dia).getByText('+2')).toBeInTheDocument();
    expect(within(dia).getByText('Cliente 2')).toBeInTheDocument();
    expect(within(dia).queryByText('Cliente 3')).not.toBeInTheDocument();
  });

  it('as setas trocam o mês e buscam o novo; "Hoje" volta ao mês e ao dia de hoje', async () => {
    renderizar();

    await usuario.click(screen.getByRole('button', { name: 'Próximo mês' }));
    expect(screen.getByRole('heading', { name: 'Novembro de 2026' })).toBeInTheDocument();
    expect(buscarCalendario).toHaveBeenCalledWith('2026-11', undefined);

    await usuario.click(screen.getByRole('button', { name: 'Mês anterior' }));
    await usuario.click(screen.getByRole('button', { name: 'Mês anterior' }));
    expect(screen.getByRole('heading', { name: 'Setembro de 2026' })).toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Hoje' }));
    expect(screen.getByRole('heading', { name: 'Outubro de 2026' })).toBeInTheDocument();
    expect(painelDoDia('segunda-feira, 19 de outubro')).toBeInTheDocument();
  });

  it('a legenda explica o marcado e o lembrete, sem falar em previsão pela recorrência', async () => {
    renderizar('REPRESENTANTE');
    const legenda = screen.getByRole('list', { name: 'Legenda' });
    const itens = within(legenda).getAllByRole('listitem').map((item) => item.textContent);
    expect(itens).toEqual(['Visita marcada no check-in', 'Lembrete', 'Data sazonal']);
    expect(legenda).not.toHaveTextContent(/prevista|recorrência/i);
  });

  it('o gestor vê a campanha entre o lembrete e a data sazonal na legenda', async () => {
    renderizar('GESTOR');
    const itens = within(screen.getByRole('list', { name: 'Legenda' }))
      .getAllByRole('listitem')
      .map((item) => item.textContent);
    expect(itens).toEqual(['Visita marcada no check-in', 'Lembrete', 'Campanha/evento', 'Data sazonal']);
  });

  it('o representante não vê "Campanha/evento" na legenda', async () => {
    renderizar('REPRESENTANTE');
    const legenda = screen.getByRole('list', { name: 'Legenda' });
    expect(within(legenda).queryByText('Campanha/evento')).not.toBeInTheDocument();
    expect(within(legenda).getByText('Data sazonal')).toBeInTheDocument();
  });

  it('o gestor vê a campanha no dia e de quem é cada visita', async () => {
    renderizar('GESTOR', [VISITA_MARCADA, CAMPANHA]);

    expect(within(screen.getByRole('list', { name: 'Legenda' })).getByText('Campanha/evento')).toBeInTheDocument();
    await usuario.click(await screen.findByRole('button', { name: 'quinta-feira, 22 de outubro, 2 itens' }));
    const painel = painelDoDia('quinta-feira, 22 de outubro');
    expect(within(painel).getByText('Campanha · 20/10/2026 a 24/12/2026')).toBeInTheDocument();
    expect(within(painel).getByText('Rep.: Eduarda Fischer')).toBeInTheDocument();
  });
});
