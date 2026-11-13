import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../services/api';
import type { Visita } from '../services/visits';
import { VisitTimeline } from './VisitTimeline';

function visita(sobrescrever: Partial<Visita>): Visita {
  return {
    id: 'v1',
    dataHora: '2026-10-18T13:00:00.000Z',
    descricao: 'Reposição do mostruário.',
    resultado: 'VENDA',
    contato: null,
    autor: { id: 'r1', nome: 'Eduarda Petzinger' },
    temFoto: false,
    fotoApagadaEm: null,
    criadoEm: '2026-10-18T13:00:00.000Z',
    editadoEm: null,
    itens: [],
    totalPedido: 0,
    campanha: null,
    notaFiscal: null,
    ...sobrescrever,
  };
}

function renderizar(
  visitas: Visita[],
  { usuarioId = 'outro', onEditar = vi.fn(), onAnexarFoto = vi.fn() } = {},
) {
  render(
    <VisitTimeline
      visitas={visitas}
      usuarioId={usuarioId}
      onEditar={onEditar}
      onAnexarFoto={onAnexarFoto}
    />,
  );
}

/** N visitas, da mais recente (descrição "Visita 1") para a mais antiga. */
function visitas(quantidade: number): Visita[] {
  return Array.from({ length: quantidade }, (_, indice) =>
    visita({ id: `v${indice + 1}`, descricao: `Visita ${indice + 1}` }),
  );
}

/** Descrições das visitas anteriores (a lista abaixo do destaque), na ordem da tela. */
function descricoesDaLista(): string[] {
  const lista = screen.queryByRole('list', { name: 'Visitas anteriores' });
  return lista ? within(lista).getAllByRole('listitem').map((item) => item.querySelector('p')!.textContent ?? '') : [];
}

describe('VisitTimeline', () => {
  it('visita com a foto removida aos 90 dias avisa e não oferece anexar outra', () => {
    renderizar([visita({ id: 'v1', temFoto: false, fotoApagadaEm: '2026-11-02T06:30:00.000Z' })], {
      usuarioId: 'r1',
    });

    expect(screen.getByText('Foto removida após 90 dias.')).toBeInTheDocument();
    expect(screen.queryByText('Anexar foto')).not.toBeInTheDocument();
    expect(screen.queryByText('Esta visita não tem foto de comprovação.')).not.toBeInTheDocument();
  });

  const ITENS_DO_PEDIDO: Visita['itens'] = [
    { sku: 'BOMB-SORT', produtoNome: 'Bombons sortidos', quantidade: 10, precoUnitario: 42 },
    { sku: 'PAO-MEL', produtoNome: 'Pães de mel', quantidade: 3, precoUnitario: 27.9 },
  ];

  it('mostra o pedido recolhido: só o total e o botão "Ver itens"', () => {
    renderizar([visita({ itens: ITENS_DO_PEDIDO, totalPedido: 503.7 })]);

    expect(screen.getByText(/^Pedido · R\$\s503,70$/)).toBeInTheDocument();
    const botao = screen.getByRole('button', { name: 'Ver itens' });
    expect(botao).toHaveAttribute('aria-expanded', 'false');
    expect(botao).toHaveAttribute('aria-controls');
    expect(screen.queryByRole('list', { name: /^Pedido/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/Bombons sortidos/)).not.toBeInTheDocument();
  });

  it('"Ver itens" mostra uma linha por item e o botão vira "Ocultar itens"', async () => {
    const usuario = userEvent.setup();
    renderizar([visita({ itens: ITENS_DO_PEDIDO, totalPedido: 503.7 })]);

    await usuario.click(screen.getByRole('button', { name: 'Ver itens' }));

    const botao = screen.getByRole('button', { name: 'Ocultar itens' });
    expect(botao).toHaveAttribute('aria-expanded', 'true');
    const pedido = screen.getByRole('list', { name: /^Pedido · R\$\s503,70$/ });
    expect(botao.getAttribute('aria-controls')).toBe(pedido.id);
    const linhas = within(pedido).getAllByRole('listitem');
    expect(linhas).toHaveLength(2);
    expect(linhas[0]).toHaveTextContent('10× Bombons sortidos');
    expect(linhas[0]).toHaveTextContent('R$ 420,00');
    expect(linhas[1]).toHaveTextContent('3× Pães de mel');
    expect(linhas[1]).toHaveTextContent('R$ 83,70');

    await usuario.click(botao);
    expect(screen.queryByRole('list', { name: /^Pedido/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver itens' })).toHaveAttribute('aria-expanded', 'false');
  });

  const ITENS_DA_NOTA: Visita['itens'] = [
    { sku: '1001', produtoNome: 'BARRA AO LEITE 35% 500 G', quantidade: 16, precoUnitario: 102.125 },
  ];

  it('visita com nota fiscal: "Pedido conforme NF" e o total da nota quando difere do pedido', () => {
    renderizar([
      visita({ itens: ITENS_DA_NOTA, totalPedido: 1634, notaFiscal: { numero: '2455', valorTotal: 1529.98 } }),
    ]);

    expect(screen.getByText(/^Pedido conforme NF 2455 · R\$\s1\.634,00$/)).toBeInTheDocument();
    expect(screen.getByText(/^Total da nota R\$\s1\.529,98$/)).toBeInTheDocument();
    expect(screen.queryByText(/^Pedido · /)).not.toBeInTheDocument();
  });

  it('visita com nota fiscal de mesmo valor do pedido não repete o total da nota', () => {
    renderizar([visita({ itens: ITENS_DA_NOTA, totalPedido: 1634, notaFiscal: { numero: '2455', valorTotal: 1634 } })]);

    expect(screen.getByText(/^Pedido conforme NF 2455 · R\$\s1\.634,00$/)).toBeInTheDocument();
    expect(screen.queryByText(/Total da nota/)).not.toBeInTheDocument();
  });

  it('abrir os itens de uma visita não abre os das outras', async () => {
    const usuario = userEvent.setup();
    renderizar([
      visita({ id: 'v1', itens: ITENS_DO_PEDIDO, totalPedido: 503.7 }),
      visita({ id: 'v2', descricao: 'Outra.', itens: ITENS_DO_PEDIDO, totalPedido: 503.7 }),
    ]);

    const [primeiro] = screen.getAllByRole('button', { name: 'Ver itens' });
    await usuario.click(primeiro);

    expect(screen.getAllByRole('list', { name: /^Pedido/ })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Ver itens' })).toHaveLength(1);
    expect(screen.getAllByRole('button', { name: 'Ocultar itens' })).toHaveLength(1);
  });

  it('mostra a etiqueta da campanha da visita ao lado do resultado', () => {
    renderizar([
      visita({ id: 'v1', campanha: { id: 'cp2', nome: 'Natal Chokolaten' } }),
      visita({ id: 'v2', descricao: 'Visita sem campanha.' }),
    ]);

    const comCampanha = screen.getByRole('region', { name: 'Última visita' });
    const [semCampanha] = within(screen.getByRole('list', { name: 'Visitas anteriores' })).getAllByRole('listitem');
    expect(within(comCampanha).getByText('Natal Chokolaten')).toBeInTheDocument();
    expect(comCampanha).toHaveTextContent('Campanha: Natal Chokolaten');
    expect(semCampanha).not.toHaveTextContent('Campanha');
  });

  it.each([
    ['VENDA', 'Houve venda'],
    ['NEGOCIACAO', 'Em negociação'],
    ['SEM_VENDA', 'Sem venda'],
  ] as const)('o resultado %s aparece numa etiqueta só de contorno', (resultado, rotulo) => {
    renderizar([visita({ resultado })]);

    expect(screen.getByText(rotulo)).toHaveAttribute('data-contorno');
  });

  it('a etiqueta da campanha continua preenchida (sem contorno)', () => {
    renderizar([visita({ campanha: { id: 'cp2', nome: 'Natal Chokolaten' } })]);

    // só a etiqueta do resultado tem contorno; a da campanha segue preenchida
    expect(document.querySelectorAll('[data-contorno]')).toHaveLength(1);
    expect(document.querySelector('[data-contorno]')).toHaveTextContent('Houve venda');
  });

  it('visita sem itens não mostra pedido', () => {
    renderizar([visita({ resultado: 'NEGOCIACAO' })]);

    expect(screen.getByText('Reposição do mostruário.')).toBeInTheDocument();
    expect(screen.queryByText(/^Pedido/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /itens/ })).not.toBeInTheDocument();
  });

  it('sem visitas: mostra o estado vazio, sem destaque nem filtro', () => {
    renderizar([]);

    expect(screen.getByText('Nenhuma visita registrada para este cliente.')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Última visita' })).not.toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
  });

  it('uma visita: aparece em destaque como "Última visita", sem filtro nem contagem', () => {
    renderizar(visitas(1));

    const destaque = screen.getByRole('region', { name: 'Última visita' });
    expect(within(destaque).getByRole('heading', { level: 3, name: 'Última visita' })).toBeVisible();
    expect(destaque).toHaveTextContent('Visita 1');
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
    expect(screen.queryByText(/no total/)).not.toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Visitas anteriores' })).not.toBeInTheDocument();
  });

  it('duas visitas: destaque + 1 anterior, filtro em "Últimas 3" e "2 visitas no total"', () => {
    renderizar(visitas(2));

    expect(screen.getByRole('region', { name: 'Última visita' })).toHaveTextContent('Visita 1');
    expect(descricoesDaLista()).toEqual(['Visita 2']);
    expect(screen.getByRole('radiogroup', { name: 'Quantas visitas anteriores mostrar' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Últimas 3' })).toBeChecked();
    expect(screen.getByText('2 visitas no total')).toBeInTheDocument();
  });

  it('dez visitas: "Últimas 3" mostra o destaque + 3; "Últimas 6" mostra + 6; "Todas" mostra + 9', async () => {
    const usuario = userEvent.setup();
    renderizar(visitas(10));

    expect(screen.getByRole('region', { name: 'Última visita' })).toHaveTextContent('Visita 1');
    expect(descricoesDaLista()).toEqual(['Visita 2', 'Visita 3', 'Visita 4']);
    expect(screen.getByText('10 visitas no total')).toBeInTheDocument();

    await usuario.click(screen.getByRole('radio', { name: 'Últimas 6' }));
    expect(descricoesDaLista()).toHaveLength(6);
    expect(descricoesDaLista()[5]).toBe('Visita 7');

    await usuario.click(screen.getByRole('radio', { name: 'Todas' }));
    expect(descricoesDaLista()).toHaveLength(9);
    expect(descricoesDaLista()[8]).toBe('Visita 10');
    expect(screen.getByRole('region', { name: 'Última visita' })).toHaveTextContent('Visita 1');
  });

  it('editar a visita funciona no destaque e na lista, enviando resultado e descrição', async () => {
    const usuario = userEvent.setup();
    const onEditar = vi.fn().mockResolvedValue(undefined);
    renderizar(visitas(2).map((v) => ({ ...v, autor: { id: 'eu', nome: 'Eu' } })), {
      usuarioId: 'eu',
      onEditar,
    });

    const destaque = screen.getByRole('region', { name: 'Última visita' });
    await usuario.click(within(destaque).getByRole('button', { name: 'Editar visita' }));
    expect(screen.getByRole('radio', { name: 'Venda' })).toHaveAttribute('aria-checked', 'true');
    await usuario.click(screen.getByRole('radio', { name: 'Negociação' }));
    const campo = screen.getByRole('textbox', { name: 'Descrição da visita' });
    await usuario.clear(campo);
    await usuario.type(campo, 'Descrição nova do destaque');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onEditar).toHaveBeenLastCalledWith('v1', {
      descricao: 'Descrição nova do destaque',
      resultado: 'NEGOCIACAO',
    });

    const lista = screen.getByRole('list', { name: 'Visitas anteriores' });
    await usuario.click(within(lista).getByRole('button', { name: 'Editar visita' }));
    const campoDaLista = screen.getByRole('textbox', { name: 'Descrição da visita' });
    await usuario.clear(campoDaLista);
    await usuario.type(campoDaLista, 'Descrição nova da lista');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(onEditar).toHaveBeenLastCalledWith('v2', { descricao: 'Descrição nova da lista' });
  });

  it('só o autor vê "Editar visita"', () => {
    renderizar([visita({ autor: { id: 'r1', nome: 'Eduarda Petzinger' } })], { usuarioId: 'outro' });

    expect(screen.queryByRole('button', { name: 'Editar visita' })).not.toBeInTheDocument();
  });

  const MENSAGEM_409 = 'Esta visita tem pedido ou nota fiscal vinculada: o resultado continua Venda.';

  it('o 409 do servidor aparece dentro da visita em edição, com a edição aberta, e Cancelar o remove', async () => {
    const usuario = userEvent.setup();
    const onEditar = vi.fn().mockRejectedValue(new ApiError('CONFLICT', MENSAGEM_409));
    renderizar(visitas(3).map((v) => ({ ...v, autor: { id: 'eu', nome: 'Eu' } })), { usuarioId: 'eu', onEditar });

    const lista = screen.getByRole('list', { name: 'Visitas anteriores' });
    const segunda = within(lista).getAllByRole('listitem')[1]!;
    await usuario.click(within(segunda).getByRole('button', { name: 'Editar visita' }));
    await usuario.click(within(segunda).getByRole('radio', { name: 'Sem venda' }));
    await usuario.click(within(segunda).getByRole('button', { name: 'Salvar' }));

    expect(await within(segunda).findByRole('alert')).toHaveTextContent(MENSAGEM_409);
    expect(screen.getAllByRole('alert')).toHaveLength(1);
    expect(within(segunda).getByRole('textbox', { name: 'Descrição da visita' })).toBeInTheDocument();

    await usuario.click(within(segunda).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('editar só o resultado envia só o resultado', async () => {
    const usuario = userEvent.setup();
    const onEditar = vi.fn().mockResolvedValue(undefined);
    renderizar([visita({ autor: { id: 'eu', nome: 'Eu' } })], { usuarioId: 'eu', onEditar });

    await usuario.click(screen.getByRole('button', { name: 'Editar visita' }));
    await usuario.click(screen.getByRole('radio', { name: 'Sem venda' }));
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onEditar).toHaveBeenCalledWith('v1', { resultado: 'SEM_VENDA' });
  });

  it('editar só a descrição envia só a descrição', async () => {
    const usuario = userEvent.setup();
    const onEditar = vi.fn().mockResolvedValue(undefined);
    renderizar([visita({ autor: { id: 'eu', nome: 'Eu' } })], { usuarioId: 'eu', onEditar });

    await usuario.click(screen.getByRole('button', { name: 'Editar visita' }));
    const campo = screen.getByRole('textbox', { name: 'Descrição da visita' });
    await usuario.clear(campo);
    await usuario.type(campo, 'Outra descrição');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onEditar).toHaveBeenCalledWith('v1', { descricao: 'Outra descrição' });
  });

  it('salvar sem mudar nada fecha a edição sem chamar o servidor', async () => {
    const usuario = userEvent.setup();
    const onEditar = vi.fn();
    renderizar([visita({ autor: { id: 'eu', nome: 'Eu' } })], { usuarioId: 'eu', onEditar });

    await usuario.click(screen.getByRole('button', { name: 'Editar visita' }));
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    expect(onEditar).not.toHaveBeenCalled();
    expect(screen.queryByRole('textbox', { name: 'Descrição da visita' })).not.toBeInTheDocument();
  });

  it('anexar a foto funciona no destaque e na lista', async () => {
    const usuario = userEvent.setup();
    const onAnexarFoto = vi.fn().mockResolvedValue(undefined);
    renderizar(visitas(2).map((v) => ({ ...v, autor: { id: 'eu', nome: 'Eu' } })), {
      usuarioId: 'eu',
      onAnexarFoto,
    });
    const foto = new File(['x'], 'foto.jpg', { type: 'image/jpeg' });

    const destaque = screen.getByRole('region', { name: 'Última visita' });
    await usuario.upload(within(destaque).getByLabelText('Anexar foto'), foto);
    expect(onAnexarFoto).toHaveBeenLastCalledWith('v1', foto);

    const lista = screen.getByRole('list', { name: 'Visitas anteriores' });
    await usuario.upload(within(lista).getByLabelText('Anexar foto'), foto);
    expect(onAnexarFoto).toHaveBeenLastCalledWith('v2', foto);
  });
});
