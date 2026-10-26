import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PerguntaSimNao } from './PerguntaSimNao';

const PERGUNTA = 'Deseja anotar um lembrete?';

/** Controlado como na página: o valor vem de fora e o clique o troca. */
function Pergunta({ aoMudar }: { aoMudar: (sim: boolean) => void }) {
  const [valor, setValor] = useState(false);
  return (
    <PerguntaSimNao
      id="pergunta"
      pergunta={PERGUNTA}
      valor={valor}
      onChange={(sim) => {
        aoMudar(sim);
        setValor(sim);
      }}
    >
      <p>Campos do lembrete</p>
    </PerguntaSimNao>
  );
}

describe('PerguntaSimNao', () => {
  it('é um grupo com a pergunta na legenda e "Não | Sim", com "Não" marcado e sem os campos', () => {
    render(<Pergunta aoMudar={() => {}} />);

    const grupo = screen.getByRole('group', { name: PERGUNTA });
    const opcoes = within(grupo).getByRole('radiogroup', { name: PERGUNTA });
    expect(within(opcoes).getAllByRole('radio').map((opcao) => opcao.textContent)).toEqual(['Não', 'Sim']);
    expect(within(opcoes).getByRole('radio', { name: 'Não' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByText('Campos do lembrete')).not.toBeInTheDocument();
  });

  it('clicar "Sim" chama onChange(true) e mostra os campos; "Não" os esconde de novo', async () => {
    const usuario = userEvent.setup({ delay: null });
    const aoMudar = vi.fn();
    render(<Pergunta aoMudar={aoMudar} />);

    await usuario.click(screen.getByRole('radio', { name: 'Sim' }));

    expect(aoMudar).toHaveBeenLastCalledWith(true);
    expect(screen.getByRole('radio', { name: 'Sim' })).toHaveAttribute('aria-checked', 'true');
    expect(within(screen.getByRole('group', { name: PERGUNTA })).getByText('Campos do lembrete')).toBeInTheDocument();

    await usuario.click(screen.getByRole('radio', { name: 'Não' }));

    expect(aoMudar).toHaveBeenLastCalledWith(false);
    expect(screen.queryByText('Campos do lembrete')).not.toBeInTheDocument();
  });
});
