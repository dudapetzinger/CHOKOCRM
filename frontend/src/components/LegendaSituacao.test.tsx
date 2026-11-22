import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import {
  LIMIAR_LARANJA_DIAS,
  LIMIAR_SEM_COMPRA_DIAS,
  LIMIAR_VERDE_AMARELO_DIAS,
} from '../config/classificacao';
import { LegendaSituacao } from './LegendaSituacao';

async function abrir() {
  render(<LegendaSituacao />);
  await userEvent.click(screen.getByRole('button', { name: 'Legenda das situações' }));
}

describe('LegendaSituacao', () => {
  it('organiza por Prioridade, Atenção, Em dia e Todos, nessa ordem', async () => {
    await abrir();

    const grupos = await screen.findAllByRole('heading', { level: 3 });
    expect(grupos.map((g) => g.textContent)).toEqual(['Prioridade', 'Atenção', 'Em dia', 'Todos']);
  });

  it('diz uma frase por situação com os números da classificação', async () => {
    await abrir();

    const prioridade = screen.getByRole('list', { name: 'Prioridade' });
    expect(within(prioridade).getByText('Atrasado')).toBeInTheDocument();
    expect(
      within(prioridade).getByText(`Mais de ${LIMIAR_LARANJA_DIAS} dias sem visita, ou nunca visitado.`),
    ).toBeInTheDocument();
    expect(within(prioridade).getByText('Vencendo')).toBeInTheDocument();
    expect(
      within(prioridade).getByText(`De ${LIMIAR_VERDE_AMARELO_DIAS + 1} a ${LIMIAR_LARANJA_DIAS} dias sem visita.`),
    ).toBeInTheDocument();
    expect(within(prioridade).getByText('Rebaixado')).toBeInTheDocument();
    expect(
      within(prioridade).getByText(
        `Visitado há até ${LIMIAR_VERDE_AMARELO_DIAS} dias, mas sem compra há mais de ${LIMIAR_SEM_COMPRA_DIAS} dias.`,
      ),
    ).toBeInTheDocument();

    const atencao = screen.getByRole('list', { name: 'Atenção' });
    expect(within(atencao).getByText('Visitado sem venda')).toBeInTheDocument();
    expect(
      within(atencao).getByText(`Visitado há até ${LIMIAR_VERDE_AMARELO_DIAS} dias e a última visita não teve venda.`),
    ).toBeInTheDocument();

    const emDia = screen.getByRole('list', { name: 'Em dia' });
    expect(within(emDia).getByText('Em dia')).toBeInTheDocument();
    expect(
      within(emDia).getByText(`Visitado há até ${LIMIAR_VERDE_AMARELO_DIAS} dias e a última visita teve venda.`),
    ).toBeInTheDocument();
  });

  it('explica o Inativo e fecha com a regra da cor', async () => {
    await abrir();

    expect(screen.getByText('Inativo')).toBeInTheDocument();
    expect(screen.getByText('Inativado pela gestão, sem cor. Aparece só na aba Todos.')).toBeInTheDocument();
    expect(
      screen.getByText(
        'A cor olha só a última visita e a última compra. Negociação conta como sem venda. Quem nunca comprou não é rebaixado.',
      ),
    ).toBeInTheDocument();
  });
});
