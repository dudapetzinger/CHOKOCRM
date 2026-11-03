import type { ReactElement } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type Role } from '../auth/auth-context';
import { Toaster } from './ui/sonner';
import { updateCliente, type ClienteCompleto, type Contato } from '../services/clients';
import { buscarProposta, gerarMensagem, type Geracao, type Proposta } from '../services/stockMessages';
import { CabecalhoCliente } from './CabecalhoCliente';

vi.mock('../services/clients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/clients')>()),
  updateCliente: vi.fn(),
}));

vi.mock('../services/stockMessages', () => ({
  buscarProposta: vi.fn(),
  gerarMensagem: vi.fn(),
}));

vi.mock('../services/users', () => ({
  listRepresentantes: vi.fn(async () => [
    { id: 'u1', nome: 'Eduarda Petzinger' },
    { id: 'r2', nome: 'Rafael Schmitt' },
  ]),
}));

const contatoPrincipal: Contato = {
  id: 'ct1',
  nome: 'Marta Hoffmann',
  cargo: 'Compradora',
  telefone: '(47) 99900-8080',
  email: 'marta@saobento.com.br',
  principal: true,
};

const contatoSecundario: Contato = {
  id: 'ct2',
  nome: 'Jonas Kraus',
  cargo: 'Gerente',
  telefone: '(47) 98888-1111',
  email: 'jonas@saobento.com.br',
  principal: false,
};

function cliente(sobrescrever: Partial<ClienteCompleto> = {}): ClienteCompleto {
  return {
    id: 'c1',
    razaoSocial: 'Armazém São Bento Ltda',
    nomeFantasia: 'Armazém São Bento',
    cnpj: '12345678000199',
    cidade: 'São Bento do Sul',
    endereco: 'Rua Principal, 100',
    telefone: '(47) 3633-1234',
    email: 'contato@saobento.com.br',
    erpId: null,
    recorrenciaDias: 30,
    ativo: true,
    criadoEm: '2026-01-10T12:00:00.000Z',
    contatos: [contatoSecundario, contatoPrincipal],
    cor: 'VERDE',
    diasSemVisita: 3,
    representante: { id: 'u1', nome: 'Eduarda Petzinger' },
    recorrenciaChanges: [],
    rebaixadoPorVenda: false,
    diasSemCompra: 3,
    proximaVisita: null,
    proximaCampanha: null,
    ...sobrescrever,
  };
}

function proposta(sobrescrever: Partial<Proposta> = {}): Proposta {
  return {
    evento: null,
    contatos: [{ id: 'ct1', nome: 'Marta Hoffmann', telefone: '(47) 99900-8080', principal: true }],
    telefoneCliente: '(47) 3633-1234',
    textoSugerido: 'Olá, Marta! Aqui é Eduarda.',
    textosSugeridos: [],
    ...sobrescrever,
  };
}

function geracao(sobrescrever: Partial<Geracao> = {}): Geracao {
  return {
    id: 'm1',
    dataGeracao: '2026-11-02T12:00:00.000Z',
    textoFinal: 'Olá, Marta! Aqui é Eduarda.',
    autor: { id: 'u1', nome: 'Eduarda Petzinger' },
    evento: null,
    cliente: { id: 'c1', nomeFantasia: 'Armazém São Bento' },
    contato: { id: 'ct1', nome: 'Marta Hoffmann' },
    telefone: '(47) 99900-8080',
    link: 'https://wa.me/5547999008080',
    ...sobrescrever,
  };
}

// Sem atraso entre as teclas: o teste não depende da velocidade da máquina.
let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  vi.mocked(updateCliente).mockReset();
  vi.mocked(buscarProposta).mockReset().mockResolvedValue(proposta());
  vi.mocked(gerarMensagem).mockReset().mockResolvedValue(geracao());
});

function renderizar(elemento: ReactElement, role: Role = 'REPRESENTANTE') {
  const auth = {
    user: { id: 'g1', nome: 'Usuário', email: 'usuario@exemplo.com', role, telefone: null, ativo: true },
    login: vi.fn(),
    logout: vi.fn(),
    recarregarUsuario: vi.fn(async () => {}),
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter>
          {elemento}
          <Toaster />
        </MemoryRouter>
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe('CabecalhoCliente', () => {
  it('mostra nome, cidade e a etiqueta de situação', () => {
    renderizar(<CabecalhoCliente cliente={cliente()} podeCheckIn={false} podeTransferir={false} />);

    expect(screen.getByRole('heading', { name: 'Armazém São Bento' })).toBeInTheDocument();
    expect(screen.getByText('São Bento do Sul')).toBeInTheDocument();
    expect(screen.getByText('Em dia · visita há 3 dias, com venda')).toBeInTheDocument();
  });

  it('liga e abre o WhatsApp com os dígitos do contato principal', () => {
    renderizar(<CabecalhoCliente cliente={cliente()} podeCheckIn={false} podeTransferir={false} />);

    expect(screen.getByText('Marta Hoffmann · (47) 99900-8080')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ligar' })).toHaveAttribute('href', 'tel:+5547999008080');
    const whatsapp = screen.getByRole('link', { name: 'WhatsApp' });
    expect(whatsapp).toHaveAttribute('href', 'https://wa.me/5547999008080');
    expect(whatsapp).toHaveAttribute('target', '_blank');
    expect(whatsapp).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('usa o telefone do cliente quando não há contato principal', () => {
    renderizar(
      <CabecalhoCliente cliente={cliente({ contatos: [contatoSecundario] })} podeCheckIn={false} podeTransferir={false} />,
    );

    expect(screen.getByRole('link', { name: 'Ligar' })).toHaveAttribute('href', 'tel:+554736331234');
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/554736331234');
  });

  it('gestor troca o representante pelo select e vê "Cliente transferido para Rafael"', async () => {
    vi.mocked(updateCliente).mockResolvedValue(cliente({ representante: { id: 'r2', nome: 'Rafael Schmitt' } }));
    renderizar(<CabecalhoCliente cliente={cliente()} podeCheckIn={false} podeTransferir />, 'GESTOR');

    const select = screen.getByRole('combobox', { name: 'Transferir cliente' });
    expect(select).toHaveValue('u1');
    await screen.findByRole('option', { name: 'Rafael Schmitt' });

    await usuario.selectOptions(select, 'r2');

    expect(updateCliente).toHaveBeenCalledTimes(1);
    expect(updateCliente).toHaveBeenCalledWith('c1', { representanteId: 'r2' });
    expect(await screen.findByText('Cliente transferido para Rafael')).toBeInTheDocument();
  });

  it('o select do gestor inclui o representante atual mesmo fora da lista (ex.: inativo)', async () => {
    renderizar(
      <CabecalhoCliente
        cliente={cliente({ representante: { id: 'u9', nome: 'Maicon Antigo' } })}
        podeCheckIn={false}
        podeTransferir
      />,
      'GESTOR',
    );

    const select = screen.getByRole('combobox', { name: 'Transferir cliente' });
    await screen.findByRole('option', { name: 'Rafael Schmitt' });
    expect(within(select).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual([
      'Eduarda Petzinger',
      'Rafael Schmitt',
      'Maicon Antigo',
    ]);
    expect(select).toHaveValue('u9');
  });

  it('representante vê o nome do representante em texto, sem select', () => {
    renderizar(<CabecalhoCliente cliente={cliente()} podeCheckIn={false} podeTransferir={false} />);

    expect(screen.getByText('Rep.: Eduarda Petzinger')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('"Novo check-in" só com podeCheckIn', () => {
    const { unmount } = renderizar(<CabecalhoCliente cliente={cliente()} podeCheckIn podeTransferir={false} />);
    expect(screen.getByRole('link', { name: 'Novo check-in' })).toHaveAttribute('href', '/clientes/c1/check-in');
    unmount();

    renderizar(<CabecalhoCliente cliente={cliente()} podeCheckIn={false} podeTransferir={false} />);
    expect(screen.queryByRole('link', { name: 'Novo check-in' })).not.toBeInTheDocument();
  });

  it('"Adicionar contato" abre o formulário do contato novo; Cancelar fecha', async () => {
    renderizar(<CabecalhoCliente cliente={cliente()} podeCheckIn={false} podeTransferir={false} />);

    await usuario.click(screen.getByRole('button', { name: 'Adicionar contato' }));
    expect(screen.getByRole('group', { name: 'Novo contato' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Adicionar contato' })).not.toBeInTheDocument();

    expect(screen.getByLabelText('Nome')).toHaveFocus();

    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('group', { name: 'Novo contato' })).not.toBeInTheDocument();
    // O foco volta para quem abriu o formulário
    expect(screen.getByRole('button', { name: 'Adicionar contato' })).toHaveFocus();
  });

  it('com podeCheckIn, o WhatsApp abre com a mensagem sugerida e registra ao clicar', async () => {
    vi.mocked(buscarProposta).mockResolvedValue(proposta({ textoSugerido: 'Olá, Marta! Aqui é Eduarda.' }));
    vi.mocked(gerarMensagem).mockResolvedValue(geracao());
    renderizar(<CabecalhoCliente cliente={cliente()} podeCheckIn podeTransferir={false} />);

    const whatsapp = await screen.findByRole('link', { name: 'WhatsApp' });
    await waitFor(() =>
      expect(whatsapp).toHaveAttribute(
        'href',
        'https://wa.me/5547999008080?text=Ol%C3%A1%2C%20Marta!%20Aqui%20%C3%A9%20Eduarda.',
      ),
    );
    // O clique não navega no jsdom; o que importa é o registro da mensagem.
    await usuario.click(whatsapp);

    expect(gerarMensagem).toHaveBeenCalledWith('c1', { texto: 'Olá, Marta! Aqui é Eduarda.', contactId: 'ct1' });
  });

  it('sem podeCheckIn, não busca a proposta e o link vai só com o número', async () => {
    renderizar(<CabecalhoCliente cliente={cliente()} podeCheckIn={false} podeTransferir={false} />);

    const whatsapp = screen.getByRole('link', { name: 'WhatsApp' });
    expect(whatsapp).toHaveAttribute('href', 'https://wa.me/5547999008080');
    await usuario.click(whatsapp);

    expect(buscarProposta).not.toHaveBeenCalled();
    expect(gerarMensagem).not.toHaveBeenCalled();
  });

  it('registro que falha avisa sem bloquear o link', async () => {
    vi.mocked(gerarMensagem).mockRejectedValue(new Error('falhou'));
    renderizar(<CabecalhoCliente cliente={cliente()} podeCheckIn podeTransferir={false} />);

    const whatsapp = await screen.findByRole('link', { name: 'WhatsApp' });
    await waitFor(() => expect(whatsapp.getAttribute('href')).toContain('?text='));
    await usuario.click(whatsapp);

    expect(await screen.findByText('A mensagem abriu no WhatsApp, mas não ficou registrada.')).toBeInTheDocument();
  });

  it('telefone sem dígitos: sem botão de WhatsApp e sem buscar a proposta', async () => {
    renderizar(<CabecalhoCliente cliente={cliente({ telefone: '', contatos: [] })} podeCheckIn podeTransferir={false} />);

    expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
    expect(buscarProposta).not.toHaveBeenCalled();
    expect(gerarMensagem).not.toHaveBeenCalled();
  });

  it('telefone 0800: sem botão de WhatsApp, sem buscar a proposta nem registrar; "Ligar" continua', async () => {
    const principal0800: Contato = { ...contatoPrincipal, telefone: '0800 123 4567' };
    renderizar(
      <CabecalhoCliente cliente={cliente({ contatos: [principal0800] })} podeCheckIn podeTransferir={false} />,
    );

    expect(screen.getByRole('link', { name: 'Ligar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Novo check-in' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
    // Dá tempo de uma busca indevida aparecer antes de afirmar que não houve.
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(buscarProposta).not.toHaveBeenCalled();
    expect(gerarMensagem).not.toHaveBeenCalled();
  });
});
