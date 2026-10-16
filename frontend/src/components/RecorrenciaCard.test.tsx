import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { alterarRecorrencia } from '../services/clients';
import { RecorrenciaCard } from './RecorrenciaCard';

vi.mock('../services/clients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/clients')>()),
  alterarRecorrencia: vi.fn(async () => ({})),
}));

// Sem atraso entre as teclas: o teste não depende da velocidade da máquina.
let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
});

function renderizar(props: Partial<Parameters<typeof RecorrenciaCard>[0]> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <RecorrenciaCard clienteId="c1" recorrenciaDias={15} historico={[]} podeAlterar {...props} />
    </QueryClientProvider>,
  );
}

async function abrirEdicao() {
  await usuario.click(screen.getByRole('button', { name: 'Alterar' }));
}

beforeEach(() => {
  vi.mocked(alterarRecorrencia).mockClear();
});

describe('RecorrenciaCard', () => {
  it('sem permissão (gestor ou cliente inativo), mostra o valor mas não o botão "Alterar"', () => {
    renderizar({ podeAlterar: false });

    expect(screen.getByText('A cada 15 dias')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Alterar' })).not.toBeInTheDocument();
  });

  it('salvar sem justificativa mostra o erro e não chama o serviço', async () => {
    renderizar();
    await abrirEdicao();
    await usuario.click(screen.getByRole('radio', { name: '20 dias' }));

    await usuario.click(screen.getByRole('button', { name: 'Salvar recorrência' }));

    expect(screen.getByText('Informe a justificativa da alteração.')).toBeInTheDocument();
    expect(alterarRecorrencia).not.toHaveBeenCalled();
  });

  it('"Outro" com 45 dias avisa que está fora da faixa sugerida e troca o botão por "Confirmar mesmo assim"', async () => {
    renderizar();
    await abrirEdicao();
    expect(screen.queryByText(/fora da faixa sugerida/)).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('radio', { name: 'Outro' }));
    await usuario.clear(screen.getByLabelText('Recorrência de visitas em dias'));
    await usuario.type(screen.getByLabelText('Recorrência de visitas em dias'), '45');

    expect(screen.getByText('Valor fora da faixa sugerida de 15 a 30 dias.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar mesmo assim' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar recorrência' })).not.toBeInTheDocument();
  });

  it('valor acima de 365 mostra o erro de validação e não chama o serviço', async () => {
    renderizar();
    await abrirEdicao();
    await usuario.click(screen.getByRole('radio', { name: 'Outro' }));
    await usuario.clear(screen.getByLabelText('Recorrência de visitas em dias'));
    await usuario.type(screen.getByLabelText('Recorrência de visitas em dias'), '400');
    await usuario.type(screen.getByLabelText('Justificativa'), 'Pedido do cliente');

    // 400 está fora de 1–365: não é "fora da faixa sugerida", o botão segue como "Salvar recorrência".
    await usuario.click(screen.getByRole('button', { name: 'Salvar recorrência' }));

    expect(screen.getByText('Recorrência de visitas deve ser um número inteiro entre 1 e 365.')).toBeInTheDocument();
    expect(alterarRecorrencia).not.toHaveBeenCalled();
  });

  it('com justificativa preenchida, grava 20 dias uma única vez e volta ao modo de leitura', async () => {
    renderizar();
    await abrirEdicao();
    await usuario.click(screen.getByRole('radio', { name: '20 dias' }));
    await usuario.click(screen.getByLabelText('Justificativa'));
    await usuario.paste('  Cliente pediu visitas mais espaçadas  ');

    await usuario.click(screen.getByRole('button', { name: 'Salvar recorrência' }));

    expect(alterarRecorrencia).toHaveBeenCalledTimes(1);
    expect(alterarRecorrencia).toHaveBeenCalledWith('c1', {
      recorrenciaDias: 20,
      justificativa: 'Cliente pediu visitas mais espaçadas',
    });
    expect(await screen.findByRole('button', { name: 'Alterar' })).toBeInTheDocument();
    expect(screen.queryByText('Informe a justificativa da alteração.')).not.toBeInTheDocument();
  });

  it('cancelar volta ao modo de leitura sem chamar o serviço', async () => {
    renderizar();
    await abrirEdicao();

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.getByRole('button', { name: 'Alterar' })).toBeInTheDocument();
    expect(alterarRecorrencia).not.toHaveBeenCalled();
  });
});
