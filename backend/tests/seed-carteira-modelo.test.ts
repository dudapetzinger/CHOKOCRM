import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { agora } from '../src/lib/relogio';
import { reiniciarDemonstracao, SENHA_DEMONSTRACAO } from '../src/seed/demonstracao';
import { dataCalendario, somarDias } from '../src/services/classificacao.service';
import { truncateAllTables } from './helpers/db';
import { fixarRelogio, liberarRelogio } from './helpers/relogio';

/**
 * A carteira modelo da demonstração como a tela de Clientes a mostra, depois
 * de `reiniciarDemonstracao` em datas de dias da semana diferentes (um
 * domingo, uma segunda antes do expediente e uma quarta à tarde), sob o ERP
 * `mock` dos testes. Cada representante entra com a própria conta e lista a
 * carteira com os inativos (`GET /clients?ativo=todos`, como `ClientesPage`);
 * as abas contam como a tela conta: Prioridade (LARANJA e VERMELHO), Atenção
 * (AMARELO) e Em dia (VERDE) só com os ativos, e o inativo só em "Todos".
 * Também confere a rota: de 4 a 5 visitas em cada dia útil antes de hoje.
 */

type ItemDaLista = {
  nomeFantasia: string;
  ativo: boolean;
  cor: 'VERDE' | 'AMARELO' | 'LARANJA' | 'VERMELHO';
  diasSemVisita: number | null;
  rebaixadoPorVenda: boolean;
};

const REPRESENTANTES = ['eduarda', 'rafael'];

/** A carteira modelo de cada representante. */
const CARTEIRA_MODELO = {
  emDia: 31,
  atencao: 5,
  prioridade: 4,
  inativos: 1,
  situacoesDaPrioridade: ['atrasado', 'nunca visitado', 'rebaixado pela compra', 'vencendo'],
};

/** Dia da semana da data de calendário: 0 = domingo … 6 = sábado. */
function diaDaSemana(data: string): number {
  return new Date(`${data}T12:00:00Z`).getUTCDay();
}

/** As abas da lista de clientes, contadas como `ClientesPage` conta. */
function abasDaLista(clientes: readonly ItemDaLista[]) {
  const ativos = clientes.filter((cliente) => cliente.ativo);
  const prioridade = ativos.filter((cliente) => cliente.cor === 'LARANJA' || cliente.cor === 'VERMELHO');
  const situacao = (cliente: ItemDaLista): string => {
    if (cliente.rebaixadoPorVenda) return 'rebaixado pela compra';
    if (cliente.diasSemVisita === null) return 'nunca visitado';
    return cliente.cor === 'VERMELHO' ? 'atrasado' : 'vencendo';
  };
  return {
    emDia: ativos.filter((cliente) => cliente.cor === 'VERDE').length,
    atencao: ativos.filter((cliente) => cliente.cor === 'AMARELO').length,
    prioridade: prioridade.length,
    inativos: clientes.filter((cliente) => !cliente.ativo).length,
    situacoesDaPrioridade: prioridade.map(situacao).sort((a, b) => a.localeCompare(b)),
  };
}

afterAll(async () => {
  liberarRelogio();
  await truncateAllTables();
  await prisma.$disconnect();
});

describe.each([
  ['um domingo', '2026-11-22T13:00:00.000Z'],
  ['uma segunda antes das 8h', '2026-11-16T10:30:00.000Z'],
  ['uma quarta à tarde', '2026-11-18T19:00:00.000Z'],
])('carteira modelo com hoje em %s (%s)', (_rotulo, instante) => {
  let hoje: Date;

  beforeAll(async () => {
    fixarRelogio(new Date(instante));
    await truncateAllTables();
    hoje = agora();
    await reiniciarDemonstracao(prisma, hoje);
  }, 180_000);

  it.each(REPRESENTANTES)('as abas da lista de clientes de %s', async (usuario) => {
    const login = await request(app).post('/auth/login').send({ usuario, senha: SENHA_DEMONSTRACAO });
    const res = await request(app)
      .get('/clients')
      .query({ ativo: 'todos' })
      .set('Authorization', `Bearer ${login.body.token as string}`);

    expect(res.status).toBe(200);
    expect({ usuario, ...abasDaLista(res.body.data as ItemDaLista[]) }).toEqual({ usuario, ...CARTEIRA_MODELO });
  });

  it('cada dia útil antes de hoje tem de 4 a 5 visitas por representante', async () => {
    const visitas = await prisma.visit.findMany({ include: { user: true } });
    const hojeDia = dataCalendario(hoje);
    const contagem = new Map<string, number>();
    for (const visita of visitas) {
      const chave = `${visita.user.usuario}|${dataCalendario(visita.dataHora)}`;
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    }
    const primeira = [...visitas.map((visita) => dataCalendario(visita.dataHora))].sort((a, b) => a.localeCompare(b))[0];
    expect(primeira).toBeDefined();
    for (let data = primeira as string; data < hojeDia; data = somarDias(data, 1)) {
      if ([0, 6].includes(diaDaSemana(data))) continue;
      for (const usuario of REPRESENTANTES) {
        const quantidade = contagem.get(`${usuario}|${data}`) ?? 0;
        expect({ data, usuario, quantidade, ok: quantidade >= 4 && quantidade <= 5 }).toMatchObject({ ok: true });
      }
    }
  });
});
