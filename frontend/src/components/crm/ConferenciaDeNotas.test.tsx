import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Leitura, NotaLida } from '../../services/importacoes';
import { ConferenciaDeNotas, type ArquivoLido } from './ConferenciaDeNotas';

function notaLida(extra: Partial<NotaLida> = {}): NotaLida {
  return {
    chaveAcesso: '4'.repeat(44),
    numero: '2455',
    serie: '1',
    dataEmissao: '2026-11-05',
    destinatarioNome: 'EMPORIO POMERODE LTDA',
    destinatarioCnpj: '12345678000190',
    cliente: { id: 'c1', nomeFantasia: 'Empório Pomerode' },
    valorTotal: 1284,
    itens: [{ codigo: 'T70', descricao: 'Tablete 70% 100 g', quantidade: 2, precoUnitario: 25.9, valorTotal: 51.8 }],
    jaImportada: false,
    ...extra,
  };
}

function lido(nome: string, leitura: Partial<Leitura> = {}): ArquivoLido {
  return { nome, estado: 'lido', leitura: { notas: [notaLida()], ignoradas: [], ...leitura } };
}

function renderizar(arquivos: ArquivoLido[], ocupado = false) {
  const aoConfirmar = vi.fn();
  const aoCancelar = vi.fn();
  render(<ConferenciaDeNotas arquivos={arquivos} ocupado={ocupado} aoConfirmar={aoConfirmar} aoCancelar={aoCancelar} />);
  return { aoConfirmar, aoCancelar };
}

/** O item de um arquivo na conferência, achado pelo nome. */
function arquivo(nome: string) {
  const lista = screen.getByRole('list', { name: 'Arquivos lidos' });
  const item = within(lista)
    .getAllByRole('listitem')
    .find((li) => li.firstElementChild?.textContent === nome);
  if (!item) throw new Error(`Arquivo "${nome}" não encontrado`);
  return item;
}

describe('ConferenciaDeNotas', () => {
  it('mostra cada nota com número, emissão, valor, destinatário, cliente e os produtos', () => {
    renderizar([lido('a.pdf')]);

    expect(screen.getByRole('heading', { name: 'Notas lidas (1)' })).toBeInTheDocument();
    const nota = within(arquivo('a.pdf')).getByRole('listitem', { name: 'NF 2455' });
    expect(nota).toHaveTextContent(/NF 2455 · 05\/11\/2026 · R\$\s1\.284,00/);
    expect(nota).toHaveTextContent('EMPORIO POMERODE LTDA · 12.345.678/0001-90');
    expect(nota).toHaveTextContent('Cliente: Empório Pomerode');
    expect(within(nota).getByText(/^2 × Tablete 70% 100 g · R\$\s25,90$/)).toBeInTheDocument();
    expect(nota).not.toHaveTextContent('Já importada');
  });

  it('nota sem cliente diz "Sem cliente no CRM"; nota já importada avisa que será atualizada', () => {
    renderizar([
      lido('a.pdf', {
        notas: [notaLida({ numero: '2456', cliente: null, jaImportada: true, chaveAcesso: '5'.repeat(44) })],
      }),
    ]);

    const nota = within(arquivo('a.pdf')).getByRole('listitem', { name: 'NF 2456' });
    expect(nota).toHaveTextContent('Sem cliente no CRM');
    expect(nota).not.toHaveTextContent('Cliente:');
    expect(within(nota).getByText('Já importada · será atualizada')).toBeInTheDocument();
  });

  it('progresso por arquivo e erro de leitura na linha do arquivo', () => {
    renderizar(
      [
        lido('a.pdf'),
        { nome: 'b.pdf', estado: 'erro', mensagem: 'Não encontrei uma DANFE legível neste PDF.' },
        { nome: 'c.pdf', estado: 'lendo' },
        { nome: 'd.pdf', estado: 'aguardando' },
      ],
      true,
    );

    expect(within(arquivo('b.pdf')).getByRole('alert')).toHaveTextContent('Não encontrei uma DANFE legível neste PDF.');
    expect(arquivo('c.pdf')).toHaveTextContent('Lendo…');
    expect(arquivo('d.pdf')).toHaveTextContent('Aguardando…');
    expect(within(arquivo('a.pdf')).queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Lendo…').closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('o título "Notas lidas" recebe o foco ao aparecer', () => {
    renderizar([lido('a.pdf')]);

    expect(screen.getByRole('heading', { name: 'Notas lidas (1)' })).toHaveFocus();
  });

  it('ignoradas aparecem com o motivo', () => {
    renderizar([
      lido('a.pdf', {
        notas: [],
        ignoradas: [
          { numero: '9', motivo: 'Devolução' },
          { numero: null, motivo: 'sem chave de acesso' },
        ],
      }),
    ]);

    expect(arquivo('a.pdf')).toHaveTextContent('Ignoradas: 9 — Devolução');
    expect(arquivo('a.pdf')).toHaveTextContent('Ignoradas: sem número — sem chave de acesso');
  });

  it('"Importando…" na linha do arquivo que está sendo gravado', () => {
    renderizar([{ ...lido('a.pdf'), gravacao: 'importando' } as ArquivoLido], true);

    expect(arquivo('a.pdf')).toHaveTextContent('Importando…');
    expect(screen.getByText('Importando…').closest('[aria-live="polite"]')).not.toBeNull();
  });

  it('"Confirmar importação" e "Cancelar" chamam as ações', async () => {
    const usuario = userEvent.setup({ delay: null });
    const { aoConfirmar, aoCancelar } = renderizar([lido('a.pdf')]);

    await usuario.click(screen.getByRole('button', { name: 'Confirmar importação' }));
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(aoConfirmar).toHaveBeenCalledTimes(1);
    expect(aoCancelar).toHaveBeenCalledTimes(1);
  });

  it('"Confirmar importação" fica desabilitado quando nenhum arquivo tem nota', () => {
    renderizar([
      lido('a.pdf', { notas: [], ignoradas: [{ numero: '9', motivo: 'Devolução' }] }),
      { nome: 'b.pdf', estado: 'erro', mensagem: 'Arquivo inválido.' },
    ]);

    expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled();
  });

  it('ocupado (lendo ou importando), os botões ficam desabilitados', () => {
    renderizar([lido('a.pdf'), { nome: 'b.pdf', estado: 'lendo' }], true);

    expect(screen.getByRole('button', { name: 'Confirmar importação' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
  });
});
