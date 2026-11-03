import type { ReactElement } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  buscarProposta,
  gerarMensagem,
  listarMensagens,
  type Proposta,
} from '../services/stockMessages';
import { MensagemEstoqueCard } from './MensagemEstoqueCard';

vi.mock('../services/stockMessages', () => ({
  buscarProposta: vi.fn(),
  gerarMensagem: vi.fn(),
  listarMensagens: vi.fn(),
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
  // Pendente: prova que o WhatsApp abre antes de o registro terminar.
  vi.mocked(gerarMensagem).mockReset().mockReturnValue(new Promise(() => {}));
  vi.mocked(listarMensagens).mockReset().mockResolvedValue([]);
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
  renderizar(<MensagemEstoqueCard clienteId="c1" podeGerar />);
  await usuario.click(screen.getByRole('button', { name: 'Gerar mensagem' }));
  await screen.findByRole('button', { name: 'Confirmar e abrir no WhatsApp' });
}

describe('MensagemEstoqueCard', () => {
  it('abre o WhatsApp no próprio toque, antes de registrar', async () => {
    await abrirFormulario();

    await usuario.click(screen.getByRole('button', { name: 'Confirmar e abrir no WhatsApp' }));

    expect(window.open).toHaveBeenCalledWith(
      'https://wa.me/5547999008080?text=Ol%C3%A1%2C%20Marta!%20Aqui%20%C3%A9%20Eduarda.',
      '_blank',
      'noopener',
    );
    expect(gerarMensagem).toHaveBeenCalledWith('c1', { texto: 'Olá, Marta! Aqui é Eduarda.', contactId: 'ct1' });
  });

  it('"Telefone do cliente" usa o telefone do cliente no link', async () => {
    await abrirFormulario();

    await usuario.selectOptions(screen.getByLabelText('Enviar para'), '');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar e abrir no WhatsApp' }));

    expect(window.open).toHaveBeenCalledWith(
      'https://wa.me/554736331234?text=Ol%C3%A1%2C%20Marta!%20Aqui%20%C3%A9%20Eduarda.',
      '_blank',
      'noopener',
    );
  });

  it('telefone que não serve para o WhatsApp (0800): não abre, mas segue para o registro, que o backend recusa', async () => {
    vi.mocked(buscarProposta).mockResolvedValue(
      proposta({ contatos: [{ id: 'ct1', nome: 'Marta Hoffmann', telefone: '0800 123 4567', principal: true }] }),
    );
    vi.mocked(gerarMensagem).mockRejectedValue(new Error('Telefone inválido'));
    await abrirFormulario();

    await usuario.click(screen.getByRole('button', { name: 'Confirmar e abrir no WhatsApp' }));

    expect(window.open).not.toHaveBeenCalled();
    expect(gerarMensagem).toHaveBeenCalledWith('c1', { texto: 'Olá, Marta! Aqui é Eduarda.', contactId: 'ct1' });
    // O WhatsApp não abriu: o aviso é o de gerar, não o de "abriu mas não registrou".
    expect(await screen.findByText('Não foi possível gerar a mensagem.')).toBeInTheDocument();
    expect(screen.queryByText('A mensagem abriu no WhatsApp, mas não ficou registrada.')).not.toBeInTheDocument();
  });

  it('registro que falha depois de abrir o WhatsApp avisa que abriu mas não ficou registrada', async () => {
    vi.mocked(gerarMensagem).mockRejectedValue(new Error('falhou'));
    await abrirFormulario();

    await usuario.click(screen.getByRole('button', { name: 'Confirmar e abrir no WhatsApp' }));

    expect(window.open).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('A mensagem abriu no WhatsApp, mas não ficou registrada.')).toBeInTheDocument();
    expect(screen.queryByText('Não foi possível gerar a mensagem.')).not.toBeInTheDocument();
  });

  it('com menos de 10 caracteres não abre nem registra', async () => {
    await abrirFormulario();

    const texto = screen.getByLabelText('Mensagem');
    await usuario.clear(texto);
    await usuario.type(texto, 'Oi');
    await usuario.click(screen.getByRole('button', { name: 'Confirmar e abrir no WhatsApp' }));

    expect(await screen.findByText('A mensagem deve ter pelo menos 10 caracteres.')).toBeInTheDocument();
    expect(window.open).not.toHaveBeenCalled();
    expect(gerarMensagem).not.toHaveBeenCalled();
  });
});
