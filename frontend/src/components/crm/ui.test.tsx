import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Avatar, Aviso, Campo, Cartao, Etiqueta } from './ui';

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

describe('Etiqueta', () => {
  it('com contorno, mostra o texto e marca o atributo data-contorno', () => {
    render(
      <Etiqueta tom="verde" contorno>
        Houve venda
      </Etiqueta>,
    );

    expect(screen.getByText('Houve venda')).toHaveAttribute('data-contorno');
  });

  it('sem contorno (padrão), mostra o texto e não tem data-contorno', () => {
    render(<Etiqueta tom="azul">Natal</Etiqueta>);

    expect(screen.getByText('Natal')).not.toHaveAttribute('data-contorno');
  });
});

describe('Cartao recolhível', () => {
  it('começa aberto, com o botão "Recolher" ligado ao conteúdo', () => {
    render(
      <Cartao titulo="Dados do ERP" recolhivel="teste-erp">
        <p>conteúdo do bloco</p>
      </Cartao>,
    );

    const botao = screen.getByRole('button', { name: 'Recolher Dados do ERP' });
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    expect(botao).toHaveAttribute('aria-controls', screen.getByText('conteúdo do bloco').parentElement!.id);
    expect(screen.getByText('conteúdo do bloco')).toBeVisible();
  });

  it('o botão recolhe e expande, trocando o nome e o aria-expanded, e o conteúdo sai da árvore de acessibilidade', async () => {
    const usuario = userEvent.setup();
    render(
      <Cartao titulo="Dados do ERP" recolhivel="teste-erp">
        <button type="button">Dentro do bloco</button>
      </Cartao>,
    );

    await usuario.click(screen.getByRole('button', { name: 'Recolher Dados do ERP' }));

    const expandir = screen.getByRole('button', { name: 'Expandir Dados do ERP' });
    expect(expandir).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Dentro do bloco' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Dados do ERP' })).toBeVisible();

    await usuario.click(expandir);

    expect(screen.getByRole('button', { name: 'Dentro do bloco' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Recolher Dados do ERP' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('com o título em elemento (ícone e texto), o nome do botão usa o texto do título', () => {
    render(
      <Cartao
        titulo={
          <span>
            <svg aria-hidden="true" />
            Insights e sugestões
          </span>
        }
        recolhivel="teste-insights"
      >
        <p>x</p>
      </Cartao>,
    );

    expect(screen.getByRole('button', { name: 'Recolher Insights e sugestões' })).toBeInTheDocument();
  });

  it('a ação do cabeçalho continua visível com o bloco recolhido', async () => {
    const usuario = userEvent.setup();
    render(
      <Cartao titulo="Contatos" recolhivel="teste-contatos" acao={<button type="button">Adicionar</button>}>
        <p>conteúdo</p>
      </Cartao>,
    );

    await usuario.click(screen.getByRole('button', { name: 'Recolher Contatos' }));

    expect(screen.getByRole('button', { name: 'Adicionar' })).toBeVisible();
    expect(screen.getByText('conteúdo')).not.toBeVisible();
  });

  it('a escolha fica guardada no navegador, por identificador do bloco', async () => {
    const usuario = userEvent.setup();
    const { unmount } = render(
      <>
        <Cartao titulo="Um" recolhivel="bloco-um">
          <p>conteúdo um</p>
        </Cartao>
        <Cartao titulo="Dois" recolhivel="bloco-dois">
          <p>conteúdo dois</p>
        </Cartao>
      </>,
    );
    await usuario.click(screen.getByRole('button', { name: 'Recolher Um' }));
    unmount();

    render(
      <>
        <Cartao titulo="Um" recolhivel="bloco-um">
          <p>conteúdo um</p>
        </Cartao>
        <Cartao titulo="Dois" recolhivel="bloco-dois">
          <p>conteúdo dois</p>
        </Cartao>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Expandir Um' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('conteúdo um')).not.toBeVisible();
    expect(screen.getByRole('button', { name: 'Recolher Dois' })).toBeInTheDocument();
    expect(screen.getByText('conteúdo dois')).toBeVisible();
  });

  it('expandir de novo apaga a escolha guardada', async () => {
    const usuario = userEvent.setup();
    const { unmount } = render(
      <Cartao titulo="Um" recolhivel="bloco-um">
        <p>conteúdo um</p>
      </Cartao>,
    );
    await usuario.click(screen.getByRole('button', { name: 'Recolher Um' }));
    await usuario.click(screen.getByRole('button', { name: 'Expandir Um' }));
    unmount();

    render(
      <Cartao titulo="Um" recolhivel="bloco-um">
        <p>conteúdo um</p>
      </Cartao>,
    );

    expect(screen.getByText('conteúdo um')).toBeVisible();
  });

  it('com o armazenamento indisponível, o cartão abre e recolhe normalmente na tela', async () => {
    const usuario = userEvent.setup();
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    render(
      <Cartao titulo="Um" recolhivel="bloco-um">
        <p>conteúdo um</p>
      </Cartao>,
    );

    expect(screen.getByText('conteúdo um')).toBeVisible();
    await usuario.click(screen.getByRole('button', { name: 'Recolher Um' }));
    expect(screen.getByText('conteúdo um')).not.toBeVisible();
    await usuario.click(screen.getByRole('button', { name: 'Expandir Um' }));
    expect(screen.getByText('conteúdo um')).toBeVisible();
    vi.restoreAllMocks();
  });

  it('sem a opção, o cartão não tem botão de recolher', () => {
    render(
      <Cartao titulo="Contatos">
        <p>conteúdo</p>
      </Cartao>,
    );

    expect(screen.queryByRole('button', { name: /Recolher|Expandir/ })).not.toBeInTheDocument();
    expect(screen.getByText('conteúdo')).toBeVisible();
  });
});
