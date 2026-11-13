import type { ReactElement } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buscarProposta, type Proposta } from '../services/stockMessages';
import { MensagemEstoqueCard } from './MensagemEstoqueCard';

vi.mock('../services/stockMessages', () => ({
  buscarProposta: vi.fn(),
}));

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
  vi.mocked(buscarProposta).mockReset().mockResolvedValue(proposta());
  vi.spyOn(window, 'open').mockReturnValue(null);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function renderizar(elemento: ReactElement) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{elemento}</QueryClientProvider>);
}

async function abrirFormulario() {
  renderizar(<MensagemEstoqueCard clienteId="c1" />);
  await usuario.click(screen.getByRole('button', { name: 'Gerar mensagem' }));
  await screen.findByRole('button', { name: 'Abrir no WhatsApp' });
}

describe('MensagemEstoqueCard', () => {
  it('não busca nada ao montar e não oferece histórico', () => {
    renderizar(<MensagemEstoqueCard clienteId="c1" />);

    expect(buscarProposta).not.toHaveBeenCalled();
    expect(screen.queryByText('Mensagens geradas')).not.toBeInTheDocument();
  });

  it('abre o WhatsApp no próprio toque, com o texto editado', async () => {
    await abrirFormulario();

    await usuario.click(screen.getByRole('button', { name: 'Abrir no WhatsApp' }));

    expect(window.open).toHaveBeenCalledWith(
      'https://wa.me/5547999008080?text=Ol%C3%A1%2C%20Marta!%20Aqui%20%C3%A9%20Eduarda.',
      '_blank',
      'noopener',
    );
  });

  it('com o principal sem telefone válido, o texto inicial é o do contato escolhido por padrão', async () => {
    vi.mocked(buscarProposta).mockResolvedValue(
      proposta({
        contatos: [
          { id: 'ct1', nome: 'Marta Hoffmann', telefone: '0800 123 456', principal: true },
          { id: 'ct2', nome: 'Paulo Reis', telefone: '(47) 98877-6655', principal: false },
        ],
        textoSugerido: 'Olá, Marta! Aqui é Eduarda.',
        textosSugeridos: [
          { contactId: 'ct1', texto: 'Olá, Marta! Aqui é Eduarda.' },
          { contactId: 'ct2', texto: 'Olá, Paulo! Aqui é Eduarda.' },
        ],
      }),
    );
    await abrirFormulario();

    expect(screen.getByLabelText('Enviar para')).toHaveValue('ct2');
    expect(screen.getByRole('textbox')).toHaveValue('Olá, Paulo! Aqui é Eduarda.');
  });

  it('"Telefone do cliente" usa o telefone do cliente no link', async () => {
    await abrirFormulario();

    await usuario.selectOptions(screen.getByLabelText('Enviar para'), '');
    await usuario.click(screen.getByRole('button', { name: 'Abrir no WhatsApp' }));

    expect(window.open).toHaveBeenCalledWith(
      'https://wa.me/554736331234?text=Ol%C3%A1%2C%20Marta!%20Aqui%20%C3%A9%20Eduarda.',
      '_blank',
      'noopener',
    );
  });

  it('telefone que não serve para o WhatsApp (0800): não abre e avisa', async () => {
    vi.mocked(buscarProposta).mockResolvedValue(
      proposta({
        contatos: [{ id: 'ct1', nome: 'Marta Hoffmann', telefone: '0800 123 4567', principal: true }],
        telefoneCliente: '0800 123 4567',
      }),
    );
    await abrirFormulario();

    await usuario.click(screen.getByRole('button', { name: 'Abrir no WhatsApp' }));

    expect(window.open).not.toHaveBeenCalled();
    expect(await screen.findByText('Este telefone não serve para o WhatsApp.')).toBeInTheDocument();
  });

  it('o seletor lista só contatos com telefone válido, o principal primeiro e depois por nome', async () => {
    vi.mocked(buscarProposta).mockResolvedValue(
      proposta({
        contatos: [
          { id: 'c3', nome: 'Zeca', telefone: '(47) 97777-0000', principal: false },
          { id: 'c4', nome: 'Sem Fone', telefone: '', principal: false },
          { id: 'c2', nome: 'Ana', telefone: '(47) 98888-1111', principal: false },
          { id: 'c1', nome: 'Marta Hoffmann', telefone: '(47) 99900-8080', principal: true },
        ],
      }),
    );
    await abrirFormulario();

    const select = screen.getByLabelText('Enviar para');
    expect(within(select).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual([
      'Marta Hoffmann — (47) 99900-8080',
      'Ana — (47) 98888-1111',
      'Zeca — (47) 97777-0000',
      'Telefone do cliente ((47) 3633-1234)',
    ]);
    expect(select).toHaveValue('c1');
  });

  it('com menos de 10 caracteres não abre', async () => {
    await abrirFormulario();

    const texto = screen.getByLabelText('Mensagem');
    await usuario.clear(texto);
    await usuario.type(texto, 'Oi');
    await usuario.click(screen.getByRole('button', { name: 'Abrir no WhatsApp' }));

    expect(await screen.findByText('A mensagem deve ter pelo menos 10 caracteres.')).toBeInTheDocument();
    expect(window.open).not.toHaveBeenCalled();
  });
});
