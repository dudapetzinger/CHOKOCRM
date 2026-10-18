import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { createContato, type Contato } from '../../services/clients';
import { NovoContato } from './NovoContato';

vi.mock('../../services/clients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../services/clients')>()),
  createContato: vi.fn(),
}));

const CONTATO_CRIADO: Contato = {
  id: 'ct9',
  nome: 'Marta Hoffmann',
  cargo: 'Compradora',
  telefone: '(47) 99900-8080',
  email: 'marta@saobento.com.br',
  principal: true,
};

// Sem atraso entre as teclas: o teste não depende da velocidade da máquina.
let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  vi.mocked(createContato).mockReset();
  vi.mocked(createContato).mockResolvedValue(CONTATO_CRIADO);
});

function renderizar(elemento: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{elemento}</QueryClientProvider>);
}

async function preencher() {
  await usuario.type(screen.getByLabelText('Nome'), 'Marta Hoffmann');
  await usuario.type(screen.getByLabelText('Cargo'), 'Compradora');
  await usuario.type(screen.getByLabelText('Telefone'), '(47) 99900-8080');
  await usuario.type(screen.getByLabelText('E-mail'), 'marta@saobento.com.br');
}

describe('NovoContato', () => {
  it('exige nome, cargo, telefone e e-mail', async () => {
    const aoConcluir = vi.fn();
    renderizar(<NovoContato clienteId="c1" aoConcluir={aoConcluir} />);

    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(screen.getByText('Nome do contato é obrigatório.')).toBeInTheDocument();
    expect(screen.getByText('Cargo do contato é obrigatório.')).toBeInTheDocument();
    expect(screen.getByText('Telefone do contato é obrigatório.')).toBeInTheDocument();
    expect(screen.getByText('E-mail do contato é obrigatório.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nome')).toHaveAttribute('aria-invalid', 'true');
    expect(createContato).not.toHaveBeenCalled();
    expect(aoConcluir).not.toHaveBeenCalled();

    await usuario.type(screen.getByLabelText('E-mail'), 'marta@');
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(screen.getByText('E-mail do contato inválido.')).toBeInTheDocument();
    expect(createContato).not.toHaveBeenCalled();
  });

  it('"Tornar principal" envia principal: true', async () => {
    const aoConcluir = vi.fn();
    renderizar(<NovoContato clienteId="c1" aoConcluir={aoConcluir} />);

    await preencher();
    await usuario.click(screen.getByRole('checkbox', { name: 'Tornar principal' }));
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(createContato).toHaveBeenCalledTimes(1);
    expect(createContato).toHaveBeenCalledWith('c1', {
      nome: 'Marta Hoffmann',
      cargo: 'Compradora',
      telefone: '(47) 99900-8080',
      email: 'marta@saobento.com.br',
      principal: true,
    });
    await vi.waitFor(() => expect(aoConcluir).toHaveBeenCalledWith(CONTATO_CRIADO));
  });

  it('sem marcar "Tornar principal", envia principal: false', async () => {
    renderizar(<NovoContato clienteId="c1" aoConcluir={vi.fn()} />);

    await preencher();
    await usuario.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(createContato).toHaveBeenCalledWith('c1', expect.objectContaining({ principal: false }));
  });

  it('Enter num campo adiciona o contato sem enviar o formulário em volta (check-in)', async () => {
    const enviarFormularioDeFora = vi.fn((evento: { preventDefault: () => void }) => evento.preventDefault());
    renderizar(
      <form onSubmit={enviarFormularioDeFora}>
        <NovoContato clienteId="c1" aoConcluir={vi.fn()} />
        <button type="submit">Salvar check-in</button>
      </form>,
    );

    await preencher();
    await usuario.type(screen.getByLabelText('E-mail'), '{Enter}');

    expect(createContato).toHaveBeenCalledTimes(1);
    expect(enviarFormularioDeFora).not.toHaveBeenCalled();
  });

  it('Cancelar fecha sem contato', async () => {
    const aoConcluir = vi.fn();
    renderizar(<NovoContato clienteId="c1" aoConcluir={aoConcluir} />);

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(aoConcluir).toHaveBeenCalledWith();
    expect(createContato).not.toHaveBeenCalled();
  });
});
