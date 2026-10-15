import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { AlertaProducao, Alertas } from '../../services/insights';
import { BarrasAlertasProducao } from './BarrasAlertasProducao';

const EVENTO = { id: 'e1', nome: 'Natal 2026', dataEvento: '2026-12-25', diasAteEvento: 72 };

function cliente(id: string, nomeFantasia: string, quantidade: number) {
  return { id, nomeFantasia, cidade: 'Blumenau', quantidade, atualizadoEm: '2026-10-14T12:00:00.000Z' };
}

function alertas(lista: AlertaProducao[], indisponiveis = 0): Alertas {
  return {
    simulado: true,
    horizonteDias: 90,
    eventos: [],
    alertas: lista,
    clientesConsultados: 4,
    clientesIndisponiveis: indisponiveis,
  };
}

function renderizar(dados: Alertas) {
  return render(
    <MemoryRouter>
      <BarrasAlertasProducao alertas={dados} />
    </MemoryRouter>,
  );
}

describe('BarrasAlertasProducao', () => {
  it('uma barra por alerta, proporcional ao maior, com os clientes linkados', () => {
    const { container } = renderizar(
      alertas([
        {
          evento: EVENTO,
          produto: { sku: 'B1', nome: 'Bombons sortidos' },
          clientes: [cliente('c1', 'Empório do Vale', 0), cliente('c2', 'Café Blumenau', 4)],
        },
        {
          evento: EVENTO,
          produto: { sku: 'C1', nome: 'Caixa presente' },
          clientes: [cliente('c3', 'Mercado Central', 9)],
        },
      ]),
    );

    const regiao = screen.getByRole('alert');
    expect(within(regiao).getByText('Bombons sortidos — Natal 2026 em 72 dias')).toBeInTheDocument();
    expect(within(regiao).getByText('2 clientes')).toBeInTheDocument();
    expect(within(regiao).getByText('1 cliente')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Café Blumenau' })).toHaveAttribute('href', '/clientes/c2');

    const larguras = [...container.querySelectorAll<HTMLElement>('.alerta-barra-valor')].map((barra) => barra.style.width);
    expect(larguras).toEqual(['100%', '50%']);
  });

  it('sem alertas, uma frase neutra que não interrompe o leitor de tela', () => {
    renderizar(alertas([]));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Nenhum alerta de produção para os próximos 90 dias.')).toBeInTheDocument();
  });

  it('com o ERP fora para todos os clientes, avisa que não deu para verificar', () => {
    renderizar(alertas([], 4));

    expect(screen.getByText(/Dados do ERP indisponíveis no momento/)).toBeInTheDocument();
  });
});
