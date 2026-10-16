import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LimiteDeErroDeCarregamento } from './LimiteDeErroDeCarregamento';

/** Como o `lazy` quando o arquivo do pedaço já não existe no servidor (deploy novo). */
function PedacoQueNaoCarrega(): never {
  throw new TypeError('Failed to fetch dynamically imported module: /assets/PainelPage-antigo.js');
}

describe('LimiteDeErroDeCarregamento', () => {
  it('sem erro, mostra o conteúdo', () => {
    render(
      <LimiteDeErroDeCarregamento>
        <p>Painel de indicadores</p>
      </LimiteDeErroDeCarregamento>,
    );

    expect(screen.getByText('Painel de indicadores')).toBeInTheDocument();
    expect(screen.queryByText('O app foi atualizado.')).not.toBeInTheDocument();
  });

  it('com o pedaço que não carrega, avisa que o app foi atualizado e "Recarregar" recarrega a página', async () => {
    // O React registra o erro capturado no console; aqui ele é o esperado.
    const erroNoConsole = vi.spyOn(console, 'error').mockImplementation(() => {});
    const recarregar = vi.fn();
    const usuario = userEvent.setup({ delay: null });

    render(
      <LimiteDeErroDeCarregamento recarregar={recarregar}>
        <PedacoQueNaoCarrega />
      </LimiteDeErroDeCarregamento>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('O app foi atualizado.');
    await usuario.click(screen.getByRole('button', { name: 'Recarregar' }));
    expect(recarregar).toHaveBeenCalledTimes(1);

    erroNoConsole.mockRestore();
  });
});
