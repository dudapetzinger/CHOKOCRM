import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ClienteCompleto } from '../services/clients';
import { DadosCadastrais } from './DadosCadastrais';

const cliente: ClienteCompleto = {
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
  contatos: [
    {
      id: 'ct1',
      nome: 'Marta Hoffmann',
      cargo: 'Compradora',
      telefone: '(47) 99900-8080',
      email: 'marta@saobento.com.br',
      principal: true,
    },
  ],
  cor: 'VERDE',
  diasSemVisita: 3,
  representante: { id: 'u1', nome: 'Eduarda Petzinger' },
  recorrenciaChanges: [],
  rebaixadoPorVenda: false,
  diasSemCompra: 3,
};

function renderizar() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <DadosCadastrais cliente={cliente} onMensagemSucesso={() => {}} />
    </QueryClientProvider>,
  );
}

describe('DadosCadastrais', () => {
  it('começa fechado (sem o atributo open)', () => {
    const { container } = renderizar();

    const detalhes = container.querySelector('details');
    expect(detalhes).toHaveClass('card', 'dados-cadastrais');
    expect(detalhes).not.toHaveAttribute('open');
    expect(screen.getByText('Dados cadastrais', { selector: 'summary' })).toBeInTheDocument();
  });

  it('guarda dentro os dados, os contatos e as ações do cadastro', () => {
    const { container } = renderizar();
    const detalhes = container.querySelector('details')!;

    expect(detalhes).toContainElement(screen.getByText('CNPJ: 12.345.678/0001-99'));
    expect(detalhes).toContainElement(screen.getByText('Marta Hoffmann'));
    expect(detalhes).toContainElement(screen.getByRole('button', { name: 'Editar dados', hidden: true }));
    expect(detalhes).toContainElement(screen.getByRole('button', { name: 'Inativar cliente', hidden: true }));
    expect(detalhes).toContainElement(screen.getByRole('button', { name: '+ Adicionar contato', hidden: true }));
  });
});
