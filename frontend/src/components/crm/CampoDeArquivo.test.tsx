import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CampoDeArquivo } from './CampoDeArquivo';

const pdf = (nome: string) => new File(['%PDF'], nome, { type: 'application/pdf' });

function renderizar(arquivos: File[] = [], extras: Partial<Parameters<typeof CampoDeArquivo>[0]> = {}) {
  const onChange = vi.fn();
  render(
    <>
      <label htmlFor="notas">Notas fiscais (PDF)</label>
      <CampoDeArquivo
        id="notas"
        rotuloDoBotao="Anexar arquivos"
        semArquivo="Nenhum arquivo selecionado"
        arquivos={arquivos}
        onChange={onChange}
        multiple
        accept=".pdf"
        {...extras}
      />
    </>,
  );
  return { onChange };
}

describe('CampoDeArquivo', () => {
  it('sem arquivo mostra o botão e o texto de nada selecionado', () => {
    renderizar();
    expect(screen.getByText('Anexar arquivos')).toBeInTheDocument();
    expect(screen.getByText('Nenhum arquivo selecionado')).toBeInTheDocument();
  });

  it('com um arquivo mostra o nome dele', () => {
    renderizar([pdf('nota-1.pdf')]);
    expect(screen.getByText('nota-1.pdf')).toBeInTheDocument();
    expect(screen.queryByText('Nenhum arquivo selecionado')).not.toBeInTheDocument();
  });

  it('com vários arquivos mostra a contagem e a lista de nomes', () => {
    renderizar([pdf('a.pdf'), pdf('b.pdf'), pdf('c.pdf')]);
    expect(screen.getByText('3 arquivos selecionados')).toBeInTheDocument();
    const lista = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(lista).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
  });

  it('o campo continua achado pelo rótulo e entrega os arquivos escolhidos', async () => {
    const { onChange } = renderizar();
    const campo = screen.getByLabelText('Notas fiscais (PDF)');
    expect(campo).toHaveAttribute('type', 'file');
    expect(campo).toHaveAttribute('multiple');
    await userEvent.upload(campo, [pdf('a.pdf'), pdf('b.pdf')]);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].map((arquivo: File) => arquivo.name)).toEqual(['a.pdf', 'b.pdf']);
  });

  it('o teclado chega ao campo', async () => {
    renderizar();
    await userEvent.tab();
    expect(screen.getByLabelText('Notas fiscais (PDF)')).toHaveFocus();
  });

  it('repassa as marcações de acessibilidade ao campo', () => {
    renderizar([], { 'aria-invalid': true, 'aria-describedby': 'erro' });
    const campo = screen.getByLabelText('Notas fiscais (PDF)');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
    expect(campo).toHaveAttribute('aria-describedby', 'erro');
  });

  it('o campo tem `title` vazio, para o navegador não mostrar o texto nativo dele', () => {
    renderizar();
    expect(screen.getByLabelText('Notas fiscais (PDF)')).toHaveAttribute('title', '');
  });

  it('a ação aparece ao lado do botão', () => {
    renderizar([], { acao: <button type="button">Ler notas</button> });
    expect(screen.getByRole('button', { name: 'Ler notas' })).toBeInTheDocument();
  });
});
