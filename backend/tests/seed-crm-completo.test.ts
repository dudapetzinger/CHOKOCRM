import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { agora } from '../src/lib/relogio';
import { EMAIL_GESTAO, reiniciarDemonstracao, SENHA_DEMONSTRACAO } from '../src/seed/demonstracao';
import { dataCalendario, inicioDoDia, somarDias } from '../src/services/classificacao.service';
import { montarMensagemDeEstoque, nomeDoEventoNoTemplate } from '../src/services/stock-message.template';
import { ativarDataDeDemonstracao, desativarDataDeDemonstracao } from './helpers/data-de-demonstracao';
import { truncateAllTables } from './helpers/db';
import { fixarRelogio, liberarRelogio } from './helpers/relogio';

/**
 * Auditoria do seed como um CRM completo e bem gerido, depois de
 * `reiniciarDemonstracao` com a data de demonstração numa quarta-feira
 * (2026-11-11), sob o ERP `mock` dos testes. Cada propriedade do "CRM
 * completo" vira um `it`: clientes com cadastro, contatos e
 * `erpId`; visitas com anotação e pedido; lembretes, mensagens de estoque e
 * metas por representante; campanhas com produtos; usuários com telefone;
 * alertas de produção e KPIs do painel com dados.
 */

const DATA = '2026-11-11';
const REPRESENTANTES = ['eduarda@chokolaten.com.br', 'rafael@chokolaten.com.br'];
const MILISSEGUNDOS_POR_HORA = 3_600_000;

const horaEmSaoPaulo = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'America/Sao_Paulo',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Dia da semana da data de calendário: 0 = domingo … 6 = sábado. */
function diaDaSemana(data: string): number {
  return new Date(`${data}T12:00:00Z`).getUTCDay();
}

/** Coluna `@db.Date` como data de calendário. */
function dia(valor: Date): string {
  return valor.toISOString().slice(0, 10);
}

let hoje: Date;

async function tokenDoGestor(): Promise<string> {
  const login = await request(app).post('/auth/login').send({ email: EMAIL_GESTAO, senha: SENHA_DEMONSTRACAO });
  return login.body.token as string;
}

beforeAll(async () => {
  // Meio-dia do dia real: a referência gravada ao ligar a data é o dia real,
  // então `agora()` cai no meio-dia de 2026-11-11 em qualquer dia da suíte.
  fixarRelogio(new Date(inicioDoDia(dataCalendario(new Date())).getTime() + 12 * MILISSEGUNDOS_POR_HORA));
  await truncateAllTables();
  await ativarDataDeDemonstracao(DATA);
  hoje = agora();
  expect(dataCalendario(hoje)).toBe(DATA);
  await reiniciarDemonstracao(prisma, hoje);
}, 180_000);

afterAll(async () => {
  await desativarDataDeDemonstracao();
  liberarRelogio();
  await prisma.$disconnect();
});

describe('seed: CRM completo', () => {
  it('todo cliente ativo tem e-mail, telefone, endereço, cidade e erpId, e 1 ou 2 contatos completos com um principal', async () => {
    const clientes = await prisma.client.findMany({ where: { ativo: true }, include: { contacts: true } });
    expect(clientes.length).toBeGreaterThan(70);

    for (const cliente of clientes) {
      const campos = {
        nome: cliente.nomeFantasia,
        email: (cliente.email ?? '').trim().length > 0,
        telefone: cliente.telefone.trim().length > 0,
        endereco: cliente.endereco.trim().length > 0,
        cidade: cliente.cidade.trim().length > 0,
        erpId: (cliente.erpId ?? '').trim().length > 0,
      };
      expect(campos).toEqual({
        nome: cliente.nomeFantasia,
        email: true,
        telefone: true,
        endereco: true,
        cidade: true,
        erpId: true,
      });
      expect(cliente.contacts.length).toBeGreaterThanOrEqual(1);
      expect(cliente.contacts.length).toBeLessThanOrEqual(2);
      for (const contato of cliente.contacts) {
        expect(contato.nome.trim().length).toBeGreaterThan(0);
        expect(contato.cargo.trim().length).toBeGreaterThan(0);
        expect(contato.telefone.trim().length).toBeGreaterThan(0);
      }
      expect(cliente.contacts.filter((contato) => contato.principal)).toHaveLength(1);
    }
  });

  it('toda visita tem anotação, toda VENDA tem pedido de 1 a 4 itens e nenhuma fica no futuro', async () => {
    const visitas = await prisma.visit.findMany({ include: { itens: true } });
    expect(visitas.length).toBeGreaterThan(0);

    for (const visita of visitas) {
      expect(visita.descricao.trim().length).toBeGreaterThan(0);
      expect(visita.dataHora.getTime()).toBeLessThanOrEqual(hoje.getTime());
      if (visita.resultado === 'VENDA') {
        expect(visita.itens.length).toBeGreaterThanOrEqual(1);
        expect(visita.itens.length).toBeLessThanOrEqual(4);
      }
    }
  });

  it('cada representante tem ao menos 3 lembretes abertos (um vencido) e 1 concluído, todos em dia útil', async () => {
    for (const email of REPRESENTANTES) {
      const lembretes = await prisma.reminder.findMany({ where: { client: { representante: { email } } } });
      const abertos = lembretes.filter((lembrete) => lembrete.concluidoEm === null);
      const vencidos = abertos.filter((lembrete) => dia(lembrete.data) < DATA);
      const concluidos = lembretes.filter((lembrete) => lembrete.concluidoEm !== null);

      expect({ email, abertos: abertos.length >= 3, vencidos: vencidos.length >= 1, concluidos: concluidos.length >= 1 })
        .toEqual({ email, abertos: true, vencidos: true, concluidos: true });
      expect(lembretes.every((lembrete) => lembrete.texto.trim().length > 0)).toBe(true);
      // Nenhum lembrete no fim de semana
      expect(lembretes.filter((lembrete) => [0, 6].includes(diaDaSemana(dia(lembrete.data))))).toEqual([]);
    }
  });

  it('cada representante tem 3 mensagens de estoque nas últimas 4 semanas, pelo template, em dia útil das 8h às 17h', async () => {
    for (const email of REPRESENTANTES) {
      const mensagens = await prisma.stockMessage.findMany({
        where: { user: { email } },
        include: { client: { include: { contacts: true, representante: true } }, user: true, eventoSazonal: true },
      });
      expect({ email, quantidade: mensagens.length }).toEqual({ email, quantidade: 3 });

      for (const mensagem of mensagens) {
        const data = dataCalendario(mensagem.dataGeracao);
        expect(data >= somarDias(DATA, -28) && data <= DATA).toBe(true);
        expect(mensagem.dataGeracao.getTime()).toBeLessThanOrEqual(hoje.getTime());
        expect([0, 6]).not.toContain(diaDaSemana(data));
        const horario = horaEmSaoPaulo.format(mensagem.dataGeracao);
        expect(horario >= '08:00' && horario <= '17:00').toBe(true);

        // Mensagem para cliente da carteira, ativo e com erpId, com o texto da regra real
        expect(mensagem.client.representante.email).toBe(email);
        expect(mensagem.client.ativo).toBe(true);
        expect(mensagem.client.erpId).not.toBeNull();
        expect(mensagem.textoFinal.trim().length).toBeGreaterThan(0);
        const principal = mensagem.client.contacts.find((contato) => contato.principal) ?? null;
        expect(mensagem.textoFinal).toBe(
          montarMensagemDeEstoque({
            nomeContato: principal?.nome ?? null,
            nomeFantasia: mensagem.client.nomeFantasia,
            nomeRepresentante: mensagem.user.nome,
            evento: mensagem.eventoSazonal
              ? {
                  nome: nomeDoEventoNoTemplate(mensagem.eventoSazonal.nome),
                  produtosSugeridos: mensagem.eventoSazonal.produtosSugeridos,
                }
              : null,
          }),
        );
        // O evento gravado é o vigente na data da geração
        const vigentes = await prisma.seasonalEvent.findMany({
          where: {
            dataInicio: { lte: new Date(`${data}T00:00:00Z`) },
            dataFim: { gte: new Date(`${data}T00:00:00Z`) },
          },
        });
        if (vigentes.length === 0) expect(mensagem.eventoSazonalId).toBeNull();
        else expect(vigentes.map((evento) => evento.id)).toContain(mensagem.eventoSazonalId);
      }
    }
  });

  it('cada representante tem meta mensal do mês de hoje e do mês seguinte', async () => {
    for (const email of REPRESENTANTES) {
      const metas = await prisma.goal.findMany({ where: { periodo: 'MENSAL', representante: { email } } });
      const periodos = metas.map((meta) => `${dia(meta.inicio)}..${dia(meta.fim)}`).sort();
      expect({ email, periodos }).toEqual({ email, periodos: ['2026-11-01..2026-11-30', '2026-12-01..2026-12-31'] });
      expect(metas.every((meta) => meta.metaVisitas > 0 && meta.metaVendas.toNumber() > 0)).toBe(true);
    }
  });

  it('campanha do mês em andamento e a próxima, com descrição e produtos', async () => {
    const campanhas = await prisma.campaign.findMany({ orderBy: { inicio: 'asc' } });
    const atual = campanhas.find((campanha) => dia(campanha.inicio) <= DATA && DATA <= dia(campanha.fim));
    expect(atual).toBeDefined();
    const proxima = campanhas.find((campanha) => dia(campanha.inicio) === somarDias(dia(atual?.fim ?? hoje), 1));
    expect(proxima).toBeDefined();
    for (const campanha of [atual, proxima]) {
      expect(campanha?.produtos.length).toBeGreaterThan(0);
      expect((campanha?.descricao ?? '').trim().length).toBeGreaterThan(0);
    }
  });

  it('todos os usuários têm telefone', async () => {
    const usuarios = await prisma.user.findMany({ where: { ativo: true } });
    expect(usuarios).toHaveLength(3);
    expect(usuarios.every((usuario) => (usuario.telefone ?? '').trim().length > 0)).toBe(true);
  });

  it('alertas de produção da gestão: ao menos um alerta no horizonte de 90 dias', async () => {
    const res = await request(app)
      .get('/insights/manager-alerts?horizonteDias=90')
      .set('Authorization', `Bearer ${await tokenDoGestor()}`);

    expect(res.status).toBe(200);
    expect(res.body.eventos.length).toBeGreaterThanOrEqual(1);
    expect(res.body.alertas.length).toBeGreaterThanOrEqual(1);
  });

  it.each([30, 90, 365])('painel da gestão com %i dias tem visitas', async (periodoDias) => {
    const res = await request(app)
      .get('/dashboard/kpis')
      .query({ periodoDias })
      .set('Authorization', `Bearer ${await tokenDoGestor()}`);

    expect(res.status).toBe(200);
    expect(res.body.visitas.total).toBeGreaterThan(0);
  });
});
