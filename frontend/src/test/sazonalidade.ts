/**
 * Resposta de `GET /insights/sazonalidade` para os testes da aba "Produção e
 * sazonalidade": o Natal 2026 (período de vendas ainda não começou, com uma
 * promoção programada e estoque baixo em dois produtos) e a Páscoa 2027 (sem
 * campanha, com um produto sem nenhum cliente baixo). Hoje é 20/11/2026.
 */
import type { DataDaSazonalidade, Sazonalidade } from '../services/insights';

export const NATAL: DataDaSazonalidade = {
  id: 'natal',
  nome: 'Natal 2026',
  chave: 'NATAL',
  data: '2026-12-25',
  diasAte: 35,
  janela: { inicio: '2026-11-25', fim: '2026-12-25' },
  janelaAnoAnterior: { inicio: '2025-11-25', fim: '2025-12-25' },
  vendasAnoAnterior: 5200.5,
  vendasNaJanelaAtual: null,
  campanhas: [
    {
      id: 'cp1',
      nome: 'Promoção de Natal',
      tipo: 'PROMOCAO',
      inicio: '2026-12-01',
      fim: '2026-12-24',
      desconto: 12,
      situacao: 'PROGRAMADA',
    },
  ],
  clientesComEstoqueBaixo: 2,
  estoqueBaixo: [
    {
      sku: 'CX-PRESENTE',
      nome: 'Caixa presente sortida',
      totalClientes: 2,
      clientes: [
        { id: 'c5', nomeFantasia: 'Bombons Indaial', cidade: 'Indaial', quantidade: 8 },
        { id: 'c1', nomeFantasia: 'Empório Pomerode', cidade: 'Pomerode', quantidade: 3 },
      ],
    },
    {
      sku: 'BOMB-SORT',
      nome: 'Bombons sortidos',
      totalClientes: 1,
      clientes: [{ id: 'c5', nomeFantasia: 'Bombons Indaial', cidade: 'Indaial', quantidade: 5 }],
    },
  ],
};

export const PASCOA: DataDaSazonalidade = {
  id: 'pascoa',
  nome: 'Páscoa 2027',
  chave: 'PASCOA',
  data: '2027-03-28',
  diasAte: 128,
  janela: { inicio: '2027-02-26', fim: '2027-03-28' },
  janelaAnoAnterior: { inicio: '2026-03-06', fim: '2026-04-05' },
  vendasAnoAnterior: 700,
  vendasNaJanelaAtual: null,
  campanhas: [],
  clientesComEstoqueBaixo: 1,
  estoqueBaixo: [
    {
      sku: 'TRUF-70',
      nome: 'Trufas 70% cacau',
      totalClientes: 1,
      clientes: [{ id: 'c1', nomeFantasia: 'Empório Pomerode', cidade: 'Pomerode', quantidade: 2 }],
    },
    { sku: 'OVO-PASCOA', nome: 'Ovo de Páscoa', totalClientes: 0, clientes: [] },
  ],
};

export const SAZONALIDADE: Sazonalidade = {
  hoje: '2026-11-20',
  horizonteDias: 180,
  simulado: true,
  limiteEstoqueBaixo: 10,
  clientesDaCarteira: 4,
  clientesConsultados: 3,
  clientesComEstoque: 2,
  estoqueIndisponivel: false,
  clientesIndisponiveis: { vendas: 0, estoque: 0 },
  datas: [NATAL, PASCOA],
};
