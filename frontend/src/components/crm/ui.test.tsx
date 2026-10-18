import { render, screen } from '@testing-library/react';
import { Avatar, Aviso, Campo, Cartao } from './ui';

describe('Campo', () => {
  it('liga o rótulo, a ajuda e o erro ao controle', () => {
    render(
      <Campo rotulo="E-mail" htmlFor="email" ajuda="O de cadastro." erro="Informe o e-mail.">
        <input id="email" />
      </Campo>,
    );

    const campo = screen.getByLabelText('E-mail');
    expect(campo).toHaveAccessibleDescription('O de cadastro. Informe o e-mail.');
    expect(campo).toHaveAttribute('aria-invalid', 'true');
  });

  it('sem erro, o controle não fica inválido e mantém a própria descrição', () => {
    render(
      <>
        <p id="extra">Mínimo de 6 caracteres.</p>
        <Campo rotulo="Senha" htmlFor="senha">
          <input id="senha" aria-describedby="extra" />
        </Campo>
      </>,
    );

    const campo = screen.getByLabelText('Senha');
    expect(campo).toHaveAccessibleDescription('Mínimo de 6 caracteres.');
    expect(campo).not.toHaveAttribute('aria-invalid');
  });
});

describe('Cartao', () => {
  it('com título, é uma região com o nome do título e mostra a ação', () => {
    render(
      <Cartao titulo="Contatos" acao={<button type="button">Adicionar</button>}>
        <p>conteúdo</p>
      </Cartao>,
    );

    const regiao = screen.getByRole('region', { name: 'Contatos' });
    expect(screen.getByRole('heading', { level: 2, name: 'Contatos' })).toBeInTheDocument();
    expect(regiao).toContainElement(screen.getByRole('button', { name: 'Adicionar' }));
    expect(regiao).toHaveTextContent('conteúdo');
  });
});

describe('Avatar', () => {
  it('mostra as iniciais, escondidas do leitor de tela (o nome está ao lado)', () => {
    const { container } = render(<Avatar nome="Eduarda Fischer" />);

    expect(container).toHaveTextContent('EF');
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });
});

describe('Aviso', () => {
  it('mostra o texto e repassa o papel (alerta para erro que aparece depois)', () => {
    render(
      <Aviso tom="erro" role="alert">
        Você está sem internet.
      </Aviso>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Você está sem internet.');
  });
});
