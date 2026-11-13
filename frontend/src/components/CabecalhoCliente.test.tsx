import type { ReactElement } from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthContext, type Role } from '../auth/auth-context';
import { Toaster } from './ui/sonner';
import { updateCliente, type ClienteCompleto, type Contato } from '../services/clients';
import { buscarProposta, type Proposta } from '../services/stockMessages';
import { CabecalhoCliente } from './CabecalhoCliente';

vi.mock('../services/clients', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/clients')>()),
  updateCliente: vi.fn(),
}));

vi.mock('../services/stockMessages', () => ({
  buscarProposta: vi.fn(),
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

// Sem atraso entre as teclas: o teste não depende da velocidade da máquina.
let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  vi.mocked(updateCliente).mockReset();
  vi.mocked(buscarProposta).mockReset().mockResolvedValue(proposta());
});

function renderizar(elemento: ReactElement, role: Role = 'REPRESENTANTE') {
  const auth = {
    user: { id: 'g1', nome: 'Usuário', usuario: 'usuario', role, telefone: null, ativo: true },
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

  it('cliente inativo mostra só "Inativo", sem a etiqueta de cor', () => {
    renderizar(<CabecalhoCliente cliente={cliente({ ativo: false })} podeCheckIn={false} podeTransferir={false} />);

    expect(screen.getByText('Inativo')).toBeInTheDocument();
    expect(screen.queryByText(/Em dia/)).not.toBeInTheDocument();
    expect(screen.queryByText(/visita há/)).not.toBeInTheDocument();
  });

  it('liga e abre o WhatsApp com os dígitos do contato principal', () => {
    renderizar(
      <CabecalhoCliente cliente={cliente({ contatos: [contatoPrincipal] })} podeCheckIn={false} podeTransferir={false} />,
    );

    expect(screen.getByText('Marta Hoffmann · (47) 99900-8080')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ligar' })).toHaveAttribute('href', 'tel:+5547999008080');
    const whatsapp = screen.getByRole('link', { name: 'WhatsApp' });
    expect(whatsapp).toHaveAttribute('href', 'https://wa.me/5547999008080');
    expect(whatsapp).toHaveAttribute('target', '_blank');
    expect(whatsapp).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('usa o telefone do cliente quando não há contato principal', () => {
    renderizar(
      <CabecalhoCliente cliente={cliente({ contatos: [{ ...contatoSecundario, telefone: '' }] })} podeCheckIn={false} podeTransferir={false} />,
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
        cliente={cliente({ representante: { id: 'u9', nome: 'Representante Antigo' } })}
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
      'Representante Antigo',
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

  it('com podeCheckIn e um só contato, o WhatsApp é o link direto com a mensagem sugerida', async () => {
    vi.mocked(buscarProposta).mockResolvedValue(proposta({ textoSugerido: 'Olá, Marta! Aqui é Eduarda.' }));
    renderizar(<CabecalhoCliente cliente={cliente({ contatos: [contatoPrincipal] })} podeCheckIn podeTransferir={false} />);

    const whatsapp = await screen.findByRole('link', { name: 'WhatsApp' });
    await waitFor(() =>
      expect(whatsapp).toHaveAttribute(
        'href',
        'https://wa.me/5547999008080?text=Ol%C3%A1%2C%20Marta!%20Aqui%20%C3%A9%20Eduarda.',
      ),
    );
    expect(screen.queryByRole('button', { name: 'WhatsApp' })).not.toBeInTheDocument();
  });

  it('com três contatos, o WhatsApp abre um menu: principal primeiro, depois por nome, cada um com o seu link', async () => {
    const contatoAna: Contato = { ...contatoSecundario, id: 'ct3', nome: 'Ana Lima', cargo: 'Balconista', telefone: '(47) 97777-2222' };
    const semTelefone: Contato = { ...contatoSecundario, id: 'ct4', nome: 'Bruno Sem Fone', telefone: '' };
    vi.mocked(buscarProposta).mockResolvedValue(
      proposta({
        textoSugerido: 'Olá! Aqui é Eduarda.',
        textosSugeridos: [
          { contactId: 'ct1', texto: 'Olá, Marta!' },
          { contactId: 'ct2', texto: 'Olá, Jonas!' },
        ],
      }),
    );
    renderizar(
      <CabecalhoCliente
        cliente={cliente({ contatos: [contatoSecundario, semTelefone, contatoAna, contatoPrincipal] })}
        podeCheckIn
        podeTransferir={false}
      />,
    );

    await waitFor(() => expect(buscarProposta).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'WhatsApp' }));

    const itens = await screen.findAllByRole('menuitem');
    expect(itens).toHaveLength(3);
    expect(screen.getByRole('menuitem', { name: 'Marta Hoffmann · Compradora Principal' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Ana Lima · Balconista' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: 'Jonas Kraus · Gerente' })).toBeInTheDocument();
    expect(itens.map((item) => item.textContent?.split(' · ')[0])).toEqual(['Marta Hoffmann', 'Ana Lima', 'Jonas Kraus']);
    await waitFor(() =>
      expect(itens.map((item) => item.getAttribute('href'))).toEqual([
        'https://wa.me/5547999008080?text=Ol%C3%A1%2C%20Marta!',
        'https://wa.me/5547977772222?text=Ol%C3%A1!%20Aqui%20%C3%A9%20Eduarda.',
        'https://wa.me/5547988881111?text=Ol%C3%A1%2C%20Jonas!',
      ]),
    );
    for (const item of itens) {
      expect(item).toHaveAttribute('target', '_blank');
      expect(item).toHaveAttribute('rel', 'noopener noreferrer');
    }
  });

  it('sem podeCheckIn, o menu de contatos leva só o número e não busca a proposta', async () => {
    renderizar(<CabecalhoCliente cliente={cliente()} podeCheckIn={false} podeTransferir={false} />);

    await usuario.click(screen.getByRole('button', { name: 'WhatsApp' }));

    const itens = await screen.findAllByRole('menuitem');
    expect(itens.map((item) => item.getAttribute('href'))).toEqual([
      'https://wa.me/5547999008080',
      'https://wa.me/5547988881111',
    ]);
    expect(buscarProposta).not.toHaveBeenCalled();
  });

  it('principal sem telefone e outro contato válido: o WhatsApp lista esse contato e a proposta é buscada', async () => {
    const principalSemTelefone: Contato = { ...contatoPrincipal, telefone: '' };
    renderizar(
      <CabecalhoCliente
        cliente={cliente({ telefone: '', contatos: [principalSemTelefone, contatoSecundario] })}
        podeCheckIn
        podeTransferir={false}
      />,
    );

    const whatsapp = await screen.findByRole('link', { name: 'WhatsApp' });
    await waitFor(() => expect(whatsapp.getAttribute('href')).toContain('https://wa.me/5547988881111?text='));
    expect(buscarProposta).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', { name: 'Ligar' })).not.toBeInTheDocument();
  });

  it('telefone sem dígitos: sem botão de WhatsApp e sem buscar a proposta', async () => {
    renderizar(<CabecalhoCliente cliente={cliente({ telefone: '', contatos: [] })} podeCheckIn podeTransferir={false} />);

    expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
    expect(buscarProposta).not.toHaveBeenCalled();
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
  });

  it('cliente criado pela nota (sem e-mail, sem contato, sem telefone e sem cidade): sem "Ligar" nem WhatsApp e sem buscar a proposta', async () => {
    renderizar(
      <CabecalhoCliente
        cliente={cliente({ email: null, telefone: '', cidade: '', contatos: [] })}
        podeCheckIn
        podeTransferir={false}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Armazém São Bento' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Ligar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'WhatsApp' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Novo check-in' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Adicionar contato' })).toBeInTheDocument();
    expect(screen.getByText(/Rep\.:/).parentElement).not.toHaveTextContent(/^\s*·/);
    expect(buscarProposta).not.toHaveBeenCalled();
  });

  describe('com telefone de teste (VITE_TELEFONE_DE_TESTE)', () => {
    afterEach(() => {
      vi.unstubAllEnvs();
    });

    it('"Ligar" e os contatos do WhatsApp vão para o telefone de teste; o telefone cadastrado continua na tela, com o aviso', async () => {
      vi.stubEnv('VITE_TELEFONE_DE_TESTE', '(47) 99783-2223');
      renderizar(<CabecalhoCliente cliente={cliente()} podeCheckIn={false} podeTransferir={false} />);

      expect(screen.getByText('Marta Hoffmann · (47) 99900-8080')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Ligar' })).toHaveAttribute('href', 'tel:+5547997832223');
      expect(screen.getByText('Modo de teste: "Ligar" e WhatsApp vão para (47) 99783-2223.')).toBeInTheDocument();

      await usuario.click(screen.getByRole('button', { name: 'WhatsApp' }));
      const itens = await screen.findAllByRole('menuitem');
      expect(itens).toHaveLength(2);
      for (const item of itens) {
        expect(item.getAttribute('href')).toMatch(/^https:\/\/wa\.me\/5547997832223/);
      }
    });

    it('sem telefone de teste, não há aviso', () => {
      vi.stubEnv('VITE_TELEFONE_DE_TESTE', '');
      renderizar(<CabecalhoCliente cliente={cliente()} podeCheckIn={false} podeTransferir={false} />);

      expect(screen.queryByText(/Modo de teste/)).not.toBeInTheDocument();
    });
  });
});
