import bcrypt from 'bcryptjs';
import request from 'supertest';
import { app } from '../src/app';
import { logger } from '../src/lib/logger';
import { prisma } from '../src/lib/prisma';
import { erpProvider } from '../src/providers/erp';
import { ErpIndisponivelError, type StockSnapshot } from '../src/providers/erp/ErpProvider';
import { perfilDoErpId } from '../src/providers/erp/mock/gerador';
import * as erpService from '../src/services/erp.service';
import type { ItemBaixo } from '../src/services/erp.service';
import { dataCalendario, fimDoDia, inicioDoDia, somarDias } from '../src/services/classificacao.service';
import { truncateAllTables } from './helpers/db';

const SENHA_PADRAO = 'chokocrm123';
const ID_INEXISTENTE = '00000000-0000-0000-0000-000000000000';

const REPRESENTANTE = {
  nome: 'Eduarda Fischer',
  email: 'eduarda.erp-teste@chokolaten.com.br',
  role: 'REPRESENTANTE' as const,
};

const GESTOR = {
  nome: 'Ricardo Menezes',
  email: 'ricardo.erp-teste@chokolaten.com.br',
  role: 'GESTOR' as const,
};

let token: string;
let tokenGestor: string;
let representanteId: string;
let clienteConhecidoId: string;
let clienteDesconhecidoId: string;
let clienteSemErpIdId: string;
let clienteSemComprasId: string;

/** Procura, entre ERP-1100 e ERP-1300, um erpId cujo perfil tenha `mesesSemCompra === 4`. */
function encontrarErpIdComQuatroMesesSemCompra(): string {
  for (let i = 1100; i <= 1300; i++) {
    const erpId = `ERP-${i}`;
    if (perfilDoErpId(erpId).mesesSemCompra === 4) {
      return erpId;
    }
  }

  throw new Error('Nenhum erpId em ERP-1100..ERP-1300 com mesesSemCompra === 4.');
}

function apelido(nomeFantasia: string): string {
  return nomeFantasia.toLowerCase().replace(/\s/g, '');
}

async function criarCliente(
  cnpj: string,
  nomeFantasia: string,
  erpId?: string,
): Promise<string> {
  const cliente = await prisma.client.create({
    data: {
      razaoSocial: `${nomeFantasia} Comércio Ltda`,
      nomeFantasia,
      cnpj,
      cidade: 'Pomerode',
      endereco: 'Rua Hermann Weege, 100',
      telefone: '(47) 3395-0000',
      email: `contato@${apelido(nomeFantasia)}.com.br`,
      recorrenciaDias: 15,
      representanteId,
      erpId,
    },
  });
  return cliente.id;
}

async function logar(email: string): Promise<string> {
  const login = await request(app).post('/auth/login').send({ email, senha: SENHA_PADRAO });
  return login.body.token;
}

beforeEach(async () => {
  await truncateAllTables();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);
  const representante = await prisma.user.create({ data: { ...REPRESENTANTE, senhaHash } });
  representanteId = representante.id;
  await prisma.user.create({ data: { ...GESTOR, senhaHash } });

  token = await logar(REPRESENTANTE.email);
  tokenGestor = await logar(GESTOR.email);

  const erpIdSemCompras = encontrarErpIdComQuatroMesesSemCompra();

  clienteConhecidoId = await criarCliente('11222333000181', 'Emporio Pomerode', 'ERP-1001');
  clienteDesconhecidoId = await criarCliente('11222333000262', 'Cafe Blumenau', 'ERP-1000-0');
  clienteSemErpIdId = await criarCliente('11222333000343', 'Doceria Jaragua');
  clienteSemComprasId = await criarCliente('11222333000424', 'Chocolates Timbo', erpIdSemCompras);
});

afterAll(async () => {
  await truncateAllTables();
  await prisma.$disconnect();
});

describe('GET /clients/:id/erp', () => {
  it('sem token responde 401', async () => {
    const res = await request(app).get(`/clients/${clienteConhecidoId}/erp`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('cliente inexistente responde 404', async () => {
    const res = await request(app)
      .get(`/clients/${ID_INEXISTENTE}/erp`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('cliente sem erpId responde 200 SEM_ERP_ID', async () => {
    const res = await request(app)
      .get(`/clients/${clienteSemErpIdId}/erp`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'SEM_ERP_ID' });
  });

  it('erpId desconhecido responde 200 NAO_ENCONTRADO', async () => {
    const res = await request(app)
      .get(`/clients/${clienteDesconhecidoId}/erp`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'NAO_ENCONTRADO' });
  });

  it('erpId conhecido responde OK com simulado true, ultimaVenda, volume90Dias e estoque', async () => {
    const res = await request(app)
      .get(`/clients/${clienteConhecidoId}/erp`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.simulado).toBe(true);
    expect(res.body.ultimaVenda).not.toBeNull();
    expect(typeof res.body.ultimaVenda.data).toBe('string');
    expect(new Date(res.body.ultimaVenda.data).toString()).not.toBe('Invalid Date');
    expect(res.body.ultimaVenda.valor).toBeGreaterThan(0);
    expect(res.body.volume90Dias.total).toBeGreaterThan(0);
    expect(res.body.volume90Dias.quantidadeVendas).toBeGreaterThan(0);
    expect(res.body.estoque).not.toBeNull();
    expect(['BAIXO', 'NORMAL', 'ALTO']).toContain(res.body.estoque.nivel);
    expect(new Date(res.body.estoque.atualizadoEm).toString()).not.toBe('Invalid Date');
    expect(Array.isArray(res.body.estoque.itensBaixos)).toBe(true);
  });

  it('cliente sem compras há 4 meses: OK com volume90Dias zerado e ultimaVenda antiga', async () => {
    const res = await request(app)
      .get(`/clients/${clienteSemComprasId}/erp`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
    expect(res.body.volume90Dias).toEqual({ total: 0, quantidadeVendas: 0 });
    expect(res.body.ultimaVenda).not.toBeNull();

    const diasDesdeAUltimaVenda =
      (Date.now() - new Date(res.body.ultimaVenda.data).getTime()) / 86_400_000;
    expect(diasDesdeAUltimaVenda).toBeGreaterThan(90);
  });

  it('provider indisponível responde 200 INDISPONIVEL', async () => {
    jest.spyOn(erpProvider, 'getLastSale').mockRejectedValueOnce(new ErpIndisponivelError());

    const res = await request(app)
      .get(`/clients/${clienteConhecidoId}/erp`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'INDISPONIVEL' });
  });

  it('a janela de volume90Dias usa dias de calendário, não uma janela corrida de 90×24h (I2)', async () => {
    // 04h UTC = 01h em America/Sao_Paulo (-03:00): ainda madrugada de
    // 29/09, bem antes das 09h locais em que o mock carimba as vendas
    // (T12:00Z). Antes da correção, `inicio`/`fim` eram `hoje ± 90×24h` em
    // instante, não em dia de calendário, então a venda de hoje (e o
    // início da janela) ficavam de fora até passar das 09h locais.
    const hoje = new Date('2026-09-29T04:00:00Z');
    const hojeCal = dataCalendario(hoje);
    const espiaoVolume = jest.spyOn(erpProvider, 'getPurchaseVolume');

    await erpService.obterDadosErp(clienteConhecidoId, hoje);

    expect(espiaoVolume).toHaveBeenCalledWith('ERP-1001', {
      inicio: inicioDoDia(somarDias(hojeCal, -90)),
      fim: fimDoDia(hojeCal),
    });
  });

  it('gestor também consulta (200)', async () => {
    const res = await request(app)
      .get(`/clients/${clienteConhecidoId}/erp`)
      .set('Authorization', `Bearer ${tokenGestor}`);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OK');
  });
});

describe('erp.service — consultas para insights', () => {
  /** Itens com `quantidade < 10` do snapshot de data mais recente, derivados direto do histórico do provider. */
  function itensBaixosDaDataMaisRecente(historico: StockSnapshot[]): ItemBaixo[] {
    const maisRecente = Math.max(...historico.map((item) => item.data.getTime()));

    return historico
      .filter((item) => item.data.getTime() === maisRecente && item.quantidade < 10)
      .map((item) => ({
        sku: item.sku,
        nome: item.nome,
        quantidade: item.quantidade,
        atualizadoEm: new Date(maisRecente),
      }));
  }

  /** Primeiro erpId a partir de ERP-1002 cujo snapshot mais recente tenha ao menos um item baixo. */
  async function encontrarErpIdComItemBaixo(): Promise<string> {
    for (let i = 1002; i <= 1100; i++) {
      const erpId = `ERP-${i}`;
      const itens = itensBaixosDaDataMaisRecente(await erpProvider.getStockHistory(erpId));

      if (itens.length > 0) {
        return erpId;
      }
    }

    throw new Error('Nenhum erpId em ERP-1002..ERP-1100 com item baixo no snapshot mais recente.');
  }

  function snapshot(data: string, sku: string, quantidade: number, nivel: StockSnapshot['nivel']): StockSnapshot {
    return { data: new Date(`${data}T12:00:00Z`), sku, nome: `Produto ${sku}`, quantidade, nivel };
  }

  it('erpSimulado reflete o provider simulado', () => {
    expect(erpService.erpSimulado()).toBe(true);
  });

  it('consultarVendas devolve as vendas do período e null quando o provider está indisponível', async () => {
    const periodo = { inicio: new Date('2000-01-01T00:00:00Z'), fim: new Date('2100-01-01T00:00:00Z') };
    const esperadas = await erpProvider.getSales('ERP-1001', periodo);
    const avisoSpy = jest.spyOn(logger, 'warn');

    expect(esperadas.length).toBeGreaterThan(0);
    await expect(erpService.consultarVendas('ERP-1001', periodo)).resolves.toEqual(esperadas);
    expect(avisoSpy).not.toHaveBeenCalled();

    jest.spyOn(erpProvider, 'getSales').mockRejectedValueOnce(new ErpIndisponivelError());
    await expect(erpService.consultarVendas('ERP-1001', periodo)).resolves.toBeNull();
    expect(avisoSpy).toHaveBeenCalledTimes(1);

    const falhaInesperada = new Error('falha inesperada');
    jest.spyOn(erpProvider, 'getSales').mockRejectedValueOnce(falhaInesperada);
    await expect(erpService.consultarVendas('ERP-1001', periodo)).rejects.toBe(falhaInesperada);
  });

  it('consultarItensBaixosEmLote: só itens com quantidade < 10 do snapshot mais recente; desconhecido → vazio; null e repetidos ignorados', async () => {
    const erpIdComItemBaixo = await encontrarErpIdComItemBaixo();
    const espiaoEstoque = jest.spyOn(erpProvider, 'getStockHistory');

    const { itensPorErpId, indisponiveis } = await erpService.consultarItensBaixosEmLote([
      'ERP-1001',
      null,
      erpIdComItemBaixo,
      'ERP-1001',
      'ERP-1001-0',
      null,
      erpIdComItemBaixo,
    ]);

    expect(indisponiveis).toEqual([]);
    expect([...itensPorErpId.keys()]).toEqual(['ERP-1001', erpIdComItemBaixo, 'ERP-1001-0']);
    expect(espiaoEstoque).toHaveBeenCalledTimes(3);

    for (const erpId of ['ERP-1001', erpIdComItemBaixo]) {
      const esperados = itensBaixosDaDataMaisRecente(await erpProvider.getStockHistory(erpId));
      expect(itensPorErpId.get(erpId)).toEqual(esperados);
    }

    const itensComBaixo = itensPorErpId.get(erpIdComItemBaixo)!;
    expect(itensComBaixo.length).toBeGreaterThan(0);
    expect(itensComBaixo.every((item) => item.quantidade < 10 && item.atualizadoEm instanceof Date)).toBe(true);
    expect(itensPorErpId.get('ERP-1001-0')).toEqual([]);
  });

  it('consultarItensBaixosEmLote: erpId cujo getStockHistory rejeita com ErpIndisponivelError vai para indisponiveis e os demais seguem', async () => {
    const avisoSpy = jest.spyOn(logger, 'warn');
    jest
      .spyOn(erpProvider, 'getStockHistory')
      .mockRejectedValueOnce(new ErpIndisponivelError())
      .mockRejectedValueOnce(new ErpIndisponivelError());

    const { itensPorErpId, indisponiveis } = await erpService.consultarItensBaixosEmLote([
      'ERP-1001',
      'ERP-1002',
      'ERP-1003',
    ]);

    expect(indisponiveis).toEqual(['ERP-1001', 'ERP-1002']);
    expect([...itensPorErpId.keys()]).toEqual(['ERP-1003']);
    expect(itensPorErpId.get('ERP-1003')).toEqual(
      itensBaixosDaDataMaisRecente(await erpProvider.getStockHistory('ERP-1003')),
    );
    expect(avisoSpy).toHaveBeenCalledTimes(1);
  });

  it('consultarItensBaixosEmLote propaga erros que não são de indisponibilidade', async () => {
    const falhaInesperada = new Error('falha inesperada');
    jest.spyOn(erpProvider, 'getStockHistory').mockRejectedValueOnce(falhaInesperada);

    await expect(erpService.consultarItensBaixosEmLote(['ERP-1001'])).rejects.toBe(falhaInesperada);
  });

  it('obterDadosErp mantém os itensBaixos do DTO só com sku, nome e quantidade', async () => {
    jest
      .spyOn(erpProvider, 'getStockHistory')
      .mockResolvedValueOnce([snapshot('2026-09-01', 'C', 4, 'BAIXO'), snapshot('2026-09-01', 'D', 30, 'NORMAL')]);

    const dados = await erpService.obterDadosErp(clienteConhecidoId);

    expect(dados.status).toBe('OK');
    expect(dados.status === 'OK' && dados.estoque).toEqual({
      nivel: 'BAIXO',
      atualizadoEm: '2026-09-01T12:00:00.000Z',
      itensBaixos: [{ sku: 'C', nome: 'Produto C', quantidade: 4 }],
    });
  });

  it('resumirEstoque segue devolvendo o pior nível da data mais recente', () => {
    const resumo = erpService.resumirEstoque([
      snapshot('2026-08-01', 'A', 3, 'BAIXO'),
      snapshot('2026-09-01', 'A', 55, 'ALTO'),
      snapshot('2026-09-01', 'B', 20, 'NORMAL'),
      snapshot('2026-09-01', 'C', 4, 'BAIXO'),
    ]);

    expect(resumo).toEqual({
      nivel: 'BAIXO',
      atualizadoEm: '2026-09-01T12:00:00.000Z',
      itensBaixos: [
        { sku: 'C', nome: 'Produto C', quantidade: 4, atualizadoEm: new Date('2026-09-01T12:00:00Z') },
      ],
    });

    const semBaixos = erpService.resumirEstoque([
      snapshot('2026-08-01', 'A', 3, 'BAIXO'),
      snapshot('2026-09-01', 'A', 55, 'ALTO'),
      snapshot('2026-09-01', 'B', 20, 'NORMAL'),
    ]);

    expect(semBaixos?.nivel).toBe('NORMAL');
    expect(semBaixos?.itensBaixos).toEqual([]);
    expect(erpService.resumirEstoque([])).toBeNull();
  });
});
