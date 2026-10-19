import type { ClienteListItem, Cor } from '../services/clients';
import { agruparPorCidade, projetarCidades } from './mapa';

const CIDADES = [
  { nome: 'Joinville', lat: -26.3045, lng: -48.8487 },
  { nome: 'Blumenau', lat: -26.9155, lng: -49.0709 },
  { nome: 'Chapecó', lat: -27.1004, lng: -52.6152 },
  { nome: 'Florianópolis', lat: -27.5954, lng: -48.548 },
];

describe('projetarCidades', () => {
  it.each([
    [520, 300, 24],
    [300, 200, 30],
    [1000, 260, 40],
  ])('em %ix%i com margem %i, todas ficam dentro da área', (largura, altura, margem) => {
    const pontos = projetarCidades(CIDADES, largura, altura, margem);

    expect(pontos.map((ponto) => ponto.nome)).toEqual(CIDADES.map((cidade) => cidade.nome));
    for (const { x, y } of pontos) {
      expect(x).toBeGreaterThanOrEqual(margem);
      expect(x).toBeLessThanOrEqual(largura - margem);
      expect(y).toBeGreaterThanOrEqual(margem);
      expect(y).toBeLessThanOrEqual(altura - margem);
    }
  });

  it('a mais a oeste fica à esquerda e a mais ao norte fica em cima', () => {
    const pontos = projetarCidades(CIDADES, 520, 300);
    const ponto = (nome: string) => pontos.find((p) => p.nome === nome)!;

    expect(ponto('Chapecó').x).toBeLessThan(ponto('Joinville').x);
    expect(ponto('Joinville').y).toBeLessThan(ponto('Florianópolis').y);
  });

  it('uma cidade só fica no centro', () => {
    expect(projetarCidades([CIDADES[0]!], 520, 300)).toEqual([{ nome: 'Joinville', x: 260, y: 150 }]);
  });

  it('margem padrão de 24', () => {
    const pontos = projetarCidades(CIDADES, 520, 300);

    expect(Math.min(...pontos.map((p) => p.x))).toBeGreaterThanOrEqual(24);
    expect(Math.max(...pontos.map((p) => p.x))).toBeLessThanOrEqual(496);
  });

  it('sem cidades, nada', () => {
    expect(projetarCidades([], 520, 300)).toEqual([]);
  });
});

function cliente(id: string, cidade: string, cor: Cor, diasSemVisita: number | null): ClienteListItem {
  return {
    id,
    nomeFantasia: `Cliente ${id}`,
    razaoSocial: `Cliente ${id} Ltda`,
    cidade,
    telefone: '(47) 3333-0000',
    ativo: true,
    contatoPrincipal: null,
    cor,
    diasSemVisita,
    rebaixadoPorVenda: false,
    representante: { id: 'u1', nome: 'Eduarda Fischer' },
  };
}

describe('agruparPorCidade', () => {
  it('junta pela cidade normalizada, com os clientes em ordem de urgência, e separa as sem coordenadas', () => {
    const { cidades, semCoordenadas } = agruparPorCidade([
      cliente('1', 'Joinville', 'VERDE', 2),
      cliente('2', 'JOINVILLE ', 'VERMELHO', 40),
      cliente('3', 'Blumenau', 'AMARELO', 10),
      cliente('4', 'Cidade Inventada', 'LARANJA', 20),
      cliente('5', 'joinvile', 'VERDE', 1),
    ]);

    expect(cidades.map(({ nome, clientes }) => [nome, clientes.map((c) => c.id)])).toEqual([
      ['Joinville', ['2', '1']],
      ['Blumenau', ['3']],
    ]);
    expect(cidades[0]).toMatchObject({ lat: -26.3045, lng: -48.8487 });
    expect(semCoordenadas).toEqual(['Cidade Inventada', 'joinvile']);
  });
});
