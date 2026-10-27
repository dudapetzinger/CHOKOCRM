import type { ClienteListItem, Cor } from '../services/clients';
import { agruparPorCidade, calcularEnquadramento, caminhoDoContorno, projetarCidades, projetarPonto } from './mapa';

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

describe('calcularEnquadramento e projetarPonto', () => {
  it('projetarPonto com o enquadramento das cidades dá o mesmo ponto que projetarCidades', () => {
    const enquadramento = calcularEnquadramento(CIDADES, 520, 300);
    const pontos = projetarCidades(CIDADES, 520, 300);

    for (const [indice, cidade] of CIDADES.entries()) {
      const { x, y } = projetarPonto(cidade.lng, cidade.lat, enquadramento);
      expect({ x, y }).toEqual({ x: pontos[indice]!.x, y: pontos[indice]!.y });
    }
  });

  it('respeita a margem passada', () => {
    const enquadramento = calcularEnquadramento(CIDADES, 520, 300, 40);
    const chapeco = projetarPonto(CIDADES[2]!.lng, CIDADES[2]!.lat, enquadramento);

    expect(chapeco.x).toBe(40);
  });

  it('um ponto fora das cidades sai da área, na direção certa (o contorno é cortado pelo viewBox)', () => {
    const enquadramento = calcularEnquadramento(CIDADES, 520, 300);
    // Mais a oeste e mais ao sul que qualquer cidade: à esquerda e abaixo da área.
    const ponto = projetarPonto(-53.8, -29.3, enquadramento);

    expect(ponto.x).toBeLessThan(0);
    expect(ponto.y).toBeGreaterThan(300);
  });

  it('uma cidade só: escala zero, tudo no centro', () => {
    const enquadramento = calcularEnquadramento([CIDADES[0]!], 520, 300);

    expect(enquadramento.escala).toBe(0);
    expect(projetarPonto(-50, -27, enquadramento)).toEqual({ x: 260, y: 150 });
  });
});

describe('caminhoDoContorno', () => {
  const ENQUADRAMENTO = calcularEnquadramento(CIDADES, 520, 300);

  it('gera M … L … Z por anel, com 1 casa decimal', () => {
    const anel: [number, number][] = [
      [CIDADES[2]!.lng, CIDADES[2]!.lat],
      [CIDADES[0]!.lng, CIDADES[0]!.lat],
      [CIDADES[3]!.lng, CIDADES[3]!.lat],
    ];
    const pontos = projetarCidades(CIDADES, 520, 300);
    const p = (nome: string) => pontos.find((ponto) => ponto.nome === nome)!;

    expect(caminhoDoContorno([anel], ENQUADRAMENTO)).toBe(
      `M ${p('Chapecó').x} ${p('Chapecó').y} L ${p('Joinville').x} ${p('Joinville').y} L ${p('Florianópolis').x} ${p('Florianópolis').y} Z`,
    );
    expect(caminhoDoContorno([anel], ENQUADRAMENTO)).toMatch(/^M -?\d+(\.\d)? -?\d+(\.\d)? L /);
  });

  it('vários anéis viram vários subcaminhos; anel vazio é ignorado', () => {
    const anel: [number, number][] = [
      [-50, -27],
      [-49, -27],
      [-49, -28],
    ];
    const caminho = caminhoDoContorno([anel, [], anel], ENQUADRAMENTO);

    expect(caminho.match(/M /g)).toHaveLength(2);
    expect(caminho.match(/Z/g)).toHaveLength(2);
    expect(caminhoDoContorno([], ENQUADRAMENTO)).toBe('');
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
