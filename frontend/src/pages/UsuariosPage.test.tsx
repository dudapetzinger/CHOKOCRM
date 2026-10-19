import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthContext, type Role } from '../auth/auth-context';
import { Toaster } from '../components/ui/sonner';
import { ApiError } from '../services/api';
import {
  atualizarUsuario,
  enviarRedefinicaoDeSenha,
  listarUsuarios,
  transferirCarteira,
  type Usuario,
} from '../services/users';
import { UsuariosPage } from './UsuariosPage';

vi.mock('../services/users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../services/users')>()),
  listarUsuarios: vi.fn(),
  atualizarUsuario: vi.fn(),
  transferirCarteira: vi.fn(),
  enviarRedefinicaoDeSenha: vi.fn(),
}));

const GESTOR: Usuario = {
  id: 'g1',
  nome: 'Marina Gestora',
  email: 'gestor@chokolaten.com.br',
  telefone: null,
  role: 'GESTOR',
  ativo: true,
  criadoEm: '2026-01-01T12:00:00.000Z',
  clientesNaCarteira: 0,
};
const RAFAEL: Usuario = {
  id: 'r1',
  nome: 'Rafael Schmitt',
  email: 'rafael@chokolaten.com.br',
  telefone: '(47) 99911-0000',
  role: 'REPRESENTANTE',
  ativo: true,
  criadoEm: '2026-01-02T12:00:00.000Z',
  clientesNaCarteira: 5,
};
const EDUARDA: Usuario = {
  id: 'r2',
  nome: 'Eduarda Fischer',
  email: 'eduarda@chokolaten.com.br',
  telefone: '(47) 99922-0000',
  role: 'REPRESENTANTE',
  ativo: true,
  criadoEm: '2026-01-03T12:00:00.000Z',
  clientesNaCarteira: 1,
};
const ANA: Usuario = {
  id: 'r3',
  nome: 'Ana Souza',
  email: 'ana@chokolaten.com.br',
  telefone: null,
  role: 'REPRESENTANTE',
  ativo: false,
  criadoEm: '2026-01-04T12:00:00.000Z',
  clientesNaCarteira: 0,
};

let usuario: ReturnType<typeof userEvent.setup>;

beforeEach(() => {
  usuario = userEvent.setup({ delay: null });
  vi.mocked(listarUsuarios).mockReset().mockResolvedValue([EDUARDA, GESTOR, RAFAEL, ANA]);
  vi.mocked(atualizarUsuario)
    .mockReset()
    .mockImplementation(async (id, input) => ({ ...[GESTOR, RAFAEL, EDUARDA, ANA].find((u) => u.id === id)!, ...input }));
  vi.mocked(transferirCarteira).mockReset().mockResolvedValue({ transferidos: 5 });
  vi.mocked(enviarRedefinicaoDeSenha).mockReset().mockResolvedValue(undefined);
});

function renderizar(role: Role = 'GESTOR') {
  const recarregarUsuario = vi.fn(async () => {});
  const auth = {
    user:
      role === 'GESTOR'
        ? { id: 'g1', nome: 'Marina Gestora', email: 'gestor@chokolaten.com.br', telefone: null, role, ativo: true }
        : { id: 'r1', nome: 'Rafael Schmitt', email: 'rafael@chokolaten.com.br', telefone: null, role, ativo: true },
    login: vi.fn(),
    logout: vi.fn(),
    recarregarUsuario,
  };
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={['/usuarios']}>
          <Routes>
            <Route path="/usuarios" element={<UsuariosPage />} />
            <Route path="/usuarios/novo" element={<p>tela de novo usuário</p>} />
          </Routes>
        </MemoryRouter>
      </AuthContext.Provider>
      <Toaster />
    </QueryClientProvider>,
  );
  return { recarregarUsuario };
}

/** A linha (item da lista) de um usuário, achada pelo nome. */
async function linhaDe(nome: string) {
  const elemento = (await screen.findByText(nome)).closest('li');
  if (!elemento) throw new Error(`Linha de "${nome}" não encontrada`);
  return elemento;
}

/** Abre o menu de ações da linha e escolhe um item. */
async function escolherAcao(nome: string, acao: string) {
  await usuario.click(await screen.findByRole('button', { name: `Ações de ${nome}` }));
  await usuario.click(await screen.findByRole('menuitem', { name: acao }));
}

async function itensDoMenu(nome: string) {
  await usuario.click(await screen.findByRole('button', { name: `Ações de ${nome}` }));
  const menu = await screen.findByRole('menu');
  return within(menu);
}

describe('UsuariosPage', () => {
  it('lista nome, "e-mail · telefone", papel, situação e "N clientes"', async () => {
    renderizar();

    const rafael = within(await linhaDe('Rafael Schmitt'));
    expect(rafael.getByText('rafael@chokolaten.com.br · (47) 99911-0000')).toBeInTheDocument();
    expect(rafael.getByText('Representante')).toBeInTheDocument();
    expect(rafael.getByText('Ativo')).toBeInTheDocument();
    expect(rafael.getByText('5 clientes')).toBeInTheDocument();

    // Sem telefone, só o e-mail; papel Gestor
    const gestor = within(await linhaDe('Marina Gestora'));
    expect(gestor.getByText('gestor@chokolaten.com.br')).toBeInTheDocument();
    expect(gestor.getByText('Gestor')).toBeInTheDocument();
    expect(gestor.getByText('0 clientes')).toBeInTheDocument();

    // Singular e inativo
    expect(within(await linhaDe('Eduarda Fischer')).getByText('1 cliente')).toBeInTheDocument();
    expect(within(await linhaDe('Ana Souza')).getByText('Inativo')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'Novo usuário' })).toHaveAttribute('href', '/usuarios/novo');
  });

  it('representante vê "Esta tela é exclusiva do gestor."', () => {
    renderizar('REPRESENTANTE');

    expect(screen.getByRole('alert')).toHaveTextContent('Esta tela é exclusiva do gestor.');
    expect(listarUsuarios).not.toHaveBeenCalled();
    expect(screen.queryByRole('link', { name: 'Novo usuário' })).not.toBeInTheDocument();
  });

  it('editar dados salva nome, e-mail, telefone e papel; papel some na própria linha', async () => {
    const { recarregarUsuario } = renderizar();

    await escolherAcao('Rafael Schmitt', 'Editar dados');
    const formulario = within(screen.getByRole('form', { name: 'Editar dados de Rafael Schmitt' }));
    await vi.waitFor(() => expect(formulario.getByLabelText('Nome')).toHaveFocus());
    fireEvent.change(formulario.getByLabelText('Nome'), { target: { value: 'Rafael S. Schmitt' } });
    fireEvent.change(formulario.getByLabelText('E-mail'), { target: { value: 'rafael.schmitt@chokolaten.com.br' } });
    fireEvent.change(formulario.getByLabelText('Telefone'), { target: { value: '' } });
    await usuario.click(formulario.getByRole('radio', { name: 'Gestor' }));
    await usuario.click(formulario.getByRole('button', { name: 'Salvar' }));

    expect(await screen.findByText('Dados atualizados')).toBeInTheDocument();
    expect(atualizarUsuario).toHaveBeenCalledWith('r1', {
      nome: 'Rafael S. Schmitt',
      email: 'rafael.schmitt@chokolaten.com.br',
      telefone: null,
      role: 'GESTOR',
    });
    expect(screen.queryByRole('form', { name: 'Editar dados de Rafael Schmitt' })).not.toBeInTheDocument();
    expect(recarregarUsuario).not.toHaveBeenCalled();

    // Na própria linha não há papel para trocar, e o menu da conta é atualizado
    await escolherAcao('Marina Gestora', 'Editar dados');
    const proprio = within(screen.getByRole('form', { name: 'Editar dados de Marina Gestora' }));
    expect(proprio.queryByRole('radiogroup', { name: 'Papel' })).not.toBeInTheDocument();
    fireEvent.change(proprio.getByLabelText('Telefone'), { target: { value: '(47) 3333-0000' } });
    await usuario.click(proprio.getByRole('button', { name: 'Salvar' }));

    await vi.waitFor(() => expect(recarregarUsuario).toHaveBeenCalledTimes(1));
    expect(atualizarUsuario).toHaveBeenLastCalledWith('g1', {
      nome: 'Marina Gestora',
      email: 'gestor@chokolaten.com.br',
      telefone: '(47) 3333-0000',
    });
  });

  it('editar dados valida no cliente e mostra o e-mail repetido (409) junto do campo', async () => {
    vi.mocked(atualizarUsuario).mockRejectedValue(
      new ApiError('CONFLICT', 'Já existe um usuário com este e-mail.'),
    );
    renderizar();

    await escolherAcao('Rafael Schmitt', 'Editar dados');
    const formulario = within(screen.getByRole('form', { name: 'Editar dados de Rafael Schmitt' }));
    fireEvent.change(formulario.getByLabelText('Nome'), { target: { value: '  ' } });
    fireEvent.change(formulario.getByLabelText('E-mail'), { target: { value: 'sem-arroba' } });
    await usuario.click(formulario.getByRole('button', { name: 'Salvar' }));

    expect(formulario.getByText('Nome é obrigatório.')).toBeInTheDocument();
    expect(formulario.getByText('E-mail inválido.')).toBeInTheDocument();
    expect(formulario.getByLabelText('Nome')).toHaveFocus();
    expect(atualizarUsuario).not.toHaveBeenCalled();

    fireEvent.change(formulario.getByLabelText('Nome'), { target: { value: 'Rafael Schmitt' } });
    fireEvent.change(formulario.getByLabelText('E-mail'), { target: { value: 'eduarda@chokolaten.com.br' } });
    await usuario.click(formulario.getByRole('button', { name: 'Salvar' }));

    expect(await formulario.findByText('Já existe um usuário com este e-mail.')).toBeInTheDocument();
    expect(formulario.getByLabelText('E-mail')).toHaveAttribute('aria-invalid', 'true');
  });

  it('inativar pede confirmação com a frase da carteira e pode transferir antes', async () => {
    renderizar();

    await escolherAcao('Rafael Schmitt', 'Inativar');
    const confirmacao = within(screen.getByRole('group', { name: 'Inativar Rafael Schmitt' }));
    expect(
      confirmacao.getByText(
        'Rafael tem 5 clientes na carteira; eles continuam na carteira até você transferi-los. Inativar?',
      ),
    ).toBeInTheDocument();

    // Destinos: só representantes ativos, sem o próprio Rafael
    const destino = confirmacao.getByRole('combobox', { name: 'Transferir carteira para' });
    await vi.waitFor(() => expect(destino).toHaveFocus());
    expect(within(destino).getAllByRole('option').map((opcao) => opcao.textContent)).toEqual([
      'Manter carteira',
      'Transferir para Eduarda',
    ]);
    await usuario.selectOptions(destino, 'r2');
    await usuario.click(confirmacao.getByRole('button', { name: 'Inativar' }));

    expect(await screen.findByText('5 clientes transferidos')).toBeInTheDocument();
    expect(await screen.findByText('Usuário inativado')).toBeInTheDocument();
    expect(transferirCarteira).toHaveBeenCalledWith('r1', 'r2');
    expect(atualizarUsuario).toHaveBeenCalledWith('r1', { ativo: false });
    // A carteira sai antes de a conta ser inativada
    expect(vi.mocked(transferirCarteira).mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(atualizarUsuario).mock.invocationCallOrder[0]!,
    );
  });

  it('inativar mantendo a carteira não transfere; cancelar não inativa', async () => {
    renderizar();

    await escolherAcao('Rafael Schmitt', 'Inativar');
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('group', { name: 'Inativar Rafael Schmitt' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ações de Rafael Schmitt' })).toHaveFocus();

    await escolherAcao('Rafael Schmitt', 'Inativar');
    await usuario.click(screen.getByRole('button', { name: 'Inativar' }));

    expect(await screen.findByText('Usuário inativado')).toBeInTheDocument();
    expect(atualizarUsuario).toHaveBeenCalledWith('r1', { ativo: false });
    expect(transferirCarteira).not.toHaveBeenCalled();
  });

  it('reativar não pede confirmação', async () => {
    renderizar();

    await escolherAcao('Ana Souza', 'Reativar');

    expect(await screen.findByText('Usuário reativado')).toBeInTheDocument();
    expect(atualizarUsuario).toHaveBeenCalledWith('r3', { ativo: true });
  });

  it('transferir carteira chama transferirCarteira e avisa "5 clientes transferidos"', async () => {
    renderizar();

    // Só para representante com clientes
    expect((await itensDoMenu('Ana Souza')).queryByRole('menuitem', { name: 'Transferir carteira' })).toBeNull();
    await usuario.keyboard('{Escape}');

    await escolherAcao('Rafael Schmitt', 'Transferir carteira');
    const painel = within(screen.getByRole('group', { name: 'Transferir carteira de Rafael Schmitt' }));
    expect(painel.getByText('Transferir os 5 clientes de Rafael para:')).toBeInTheDocument();
    const transferir = painel.getByRole('button', { name: 'Transferir' });
    expect(transferir).toBeDisabled();

    await usuario.selectOptions(painel.getByRole('combobox', { name: 'Representante de destino' }), 'r2');
    await usuario.click(transferir);

    expect(await screen.findByText('5 clientes transferidos')).toBeInTheDocument();
    expect(transferirCarteira).toHaveBeenCalledWith('r1', 'r2');
    expect(screen.queryByRole('group', { name: 'Transferir carteira de Rafael Schmitt' })).not.toBeInTheDocument();
  });

  it('erro da transferência aparece no painel', async () => {
    vi.mocked(transferirCarteira).mockRejectedValue(new ApiError('VALIDATION_ERROR', 'Representante inativo.'));
    renderizar();

    await escolherAcao('Rafael Schmitt', 'Transferir carteira');
    const painel = within(screen.getByRole('group', { name: 'Transferir carteira de Rafael Schmitt' }));
    await usuario.selectOptions(painel.getByRole('combobox', { name: 'Representante de destino' }), 'r2');
    await usuario.click(painel.getByRole('button', { name: 'Transferir' }));

    expect(await painel.findByRole('alert')).toHaveTextContent('Representante inativo.');
  });

  it('redefinir senha chama enviarRedefinicaoDeSenha e avisa "Link de redefinição enviado para rafael@…"', async () => {
    renderizar();

    await escolherAcao('Rafael Schmitt', 'Redefinir senha');

    expect(
      await screen.findByText('Link de redefinição enviado para rafael@chokolaten.com.br'),
    ).toBeInTheDocument();
    expect(enviarRedefinicaoDeSenha).toHaveBeenCalledWith('r1');
  });

  it('erro 503 do envio aparece como aviso de erro', async () => {
    vi.mocked(enviarRedefinicaoDeSenha).mockRejectedValue(
      new ApiError('SERVICE_UNAVAILABLE', 'Envio de e-mail não configurado.'),
    );
    renderizar();

    await escolherAcao('Rafael Schmitt', 'Redefinir senha');

    expect(await screen.findByText('Envio de e-mail não configurado.')).toBeInTheDocument();
    expect(screen.queryByText(/Link de redefinição enviado/)).not.toBeInTheDocument();
  });

  it('na própria conta "Inativar" fica desabilitado; "Editar dados" e "Redefinir senha" continuam', async () => {
    renderizar();

    const menu = await itensDoMenu('Marina Gestora');
    expect(menu.getByRole('menuitem', { name: 'Inativar' })).toHaveAttribute('aria-disabled', 'true');
    expect(menu.getByRole('menuitem', { name: 'Editar dados' })).not.toHaveAttribute('aria-disabled');
    expect(menu.getByRole('menuitem', { name: 'Redefinir senha' })).not.toHaveAttribute('aria-disabled');
    expect(menu.queryByRole('menuitem', { name: 'Transferir carteira' })).not.toBeInTheDocument();
  });

  it('falha ao carregar mostra o aviso de erro', async () => {
    vi.mocked(listarUsuarios).mockRejectedValue(new ApiError('NETWORK', 'Você está sem internet.'));
    renderizar();

    expect(await screen.findByRole('alert')).toHaveTextContent('Você está sem internet.');
  });
});
