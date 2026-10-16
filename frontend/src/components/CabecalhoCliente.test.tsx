import { render, screen } from '@testing-library/react';
import type { ClienteCompleto, Contato } from '../services/clients';
import { CabecalhoCliente } from './CabecalhoCliente';

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
    ...sobrescrever,
  };
}

describe('CabecalhoCliente', () => {
  it('mostra nome, cidade e a etiqueta de situação', () => {
    render(<CabecalhoCliente cliente={cliente()} mostrarRepresentante={false} />);

    expect(screen.getByRole('heading', { name: 'Armazém São Bento' })).toBeInTheDocument();
    expect(screen.getByText('São Bento do Sul')).toBeInTheDocument();
    expect(screen.getByText('Em dia · visita há 3 dias, com venda')).toHaveClass(
      'etiqueta-situacao',
      'etiqueta-verde',
    );
  });

  it('liga e abre o WhatsApp com os dígitos do contato principal', () => {
    render(<CabecalhoCliente cliente={cliente()} mostrarRepresentante={false} />);

    expect(screen.getByRole('link', { name: 'Ligar' })).toHaveAttribute('href', 'tel:+5547999008080');
    const whatsapp = screen.getByRole('link', { name: 'WhatsApp' });
    expect(whatsapp).toHaveAttribute('href', 'https://wa.me/5547999008080');
    expect(whatsapp).toHaveAttribute('target', '_blank');
    expect(whatsapp).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('usa o telefone do cliente quando não há contato principal', () => {
    render(
      <CabecalhoCliente cliente={cliente({ contatos: [contatoSecundario] })} mostrarRepresentante={false} />,
    );

    expect(screen.getByRole('link', { name: 'Ligar' })).toHaveAttribute('href', 'tel:+554736331234');
    expect(screen.getByRole('link', { name: 'WhatsApp' })).toHaveAttribute('href', 'https://wa.me/554736331234');
  });

  it('mostra "Rep.:" só quando mostrarRepresentante', () => {
    const { unmount } = render(<CabecalhoCliente cliente={cliente()} mostrarRepresentante />);
    expect(screen.getByText('Rep.: Eduarda Petzinger')).toBeInTheDocument();
    unmount();

    render(<CabecalhoCliente cliente={cliente()} mostrarRepresentante={false} />);
    expect(screen.queryByText(/Rep\.:/)).not.toBeInTheDocument();
  });
});
