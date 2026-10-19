import { MUNICIPIOS_SC } from './municipiosSC';
import {
  coordenadaDaCidade,
  enderecoCompleto,
  linkGoogleMaps,
  montarRoteiro,
  normalizarCidade,
  type Parada,
} from './roteiro';

function parada(id: string, cidade: string, endereco = `Rua ${id}, 10`): Parada {
  return { id, nome: `Cliente ${id}`, cidade, endereco };
}

describe('tabela de municípios de SC', () => {
  it('tem os 295 municípios, com as chaves já normalizadas', () => {
    const chaves = Object.keys(MUNICIPIOS_SC);

    expect(chaves).toHaveLength(295);
    expect(chaves).toEqual(expect.arrayContaining(['blumenau', 'jaragua do sul', 'sao bento do sul']));
    expect(chaves.filter((chave) => normalizarCidade(chave) !== chave)).toEqual([]);
  });
});

describe('normalizarCidade', () => {
  it('tira acento, passa a minúsculas e deixa um espaço só entre as palavras', () => {
    expect(normalizarCidade('  Jaraguá   do  Sul ')).toBe('jaragua do sul');
  });

  it('"Jaraguá do Sul", "jaragua do sul" e "JARAGUÁ DO SUL" acham a mesma coordenada', () => {
    const coordenada = coordenadaDaCidade('Jaraguá do Sul');

    expect(coordenada).toEqual(MUNICIPIOS_SC['jaragua do sul']);
    expect(coordenadaDaCidade('jaragua do sul')).toEqual(coordenada);
    expect(coordenadaDaCidade('JARAGUÁ DO SUL')).toEqual(coordenada);
    expect(coordenadaDaCidade('Atlântida')).toBeNull();
  });
});

describe('montarRoteiro', () => {
  it('a parada 1 é a primeira recebida (a mais urgente), mesmo que outra esteja mais perto das demais', () => {
    const { paradas } = montarRoteiro([parada('a', 'Florianópolis'), parada('b', 'Blumenau'), parada('c', 'Gaspar')]);

    expect(paradas[0]).toMatchObject({ id: 'a', kmDesdeAnterior: null, mesmaCidade: false });
  });

  it('a seguinte é a mais próxima da anterior, com a distância em linha reta × 1,3, arredondada', () => {
    const { paradas, kmTotal } = montarRoteiro([
      parada('blumenau', 'Blumenau'),
      parada('joinville', 'Joinville'),
      parada('gaspar', 'Gaspar'),
    ]);

    expect(paradas.map((item) => item.id)).toEqual(['blumenau', 'gaspar', 'joinville']);
    // Blumenau -> Gaspar: cerca de 12 km em linha reta
    expect(paradas[1]?.kmDesdeAnterior).toBe(15);
    expect(paradas[2]?.kmDesdeAnterior).toBeGreaterThan(80);
    expect(kmTotal).toBe(15 + (paradas[2]?.kmDesdeAnterior ?? 0));
  });

  it('com 12 recebidas, 10 entram no roteiro e 2 ficam de fora', () => {
    const recebidas = Array.from({ length: 12 }, (_, i) => parada(`p${i}`, 'Blumenau'));

    const roteiro = montarRoteiro(recebidas);

    expect(roteiro.paradas).toHaveLength(10);
    expect(roteiro.foraDoRoteiro).toBe(2);
    expect(roteiro.paradas.map((item) => item.id)).not.toContain('p10');
  });

  it('cidade desconhecida vai para o fim, sem distância', () => {
    const { paradas } = montarRoteiro([
      parada('a', 'Blumenau'),
      parada('x', 'Cidade Inventada'),
      parada('b', 'Pomerode'),
    ]);

    expect(paradas.map((item) => item.id)).toEqual(['a', 'b', 'x']);
    expect(paradas[2]).toMatchObject({ id: 'x', kmDesdeAnterior: null, mesmaCidade: false });
  });

  it('duas na mesma cidade ficam juntas e marcam mesmaCidade, sem somar distância', () => {
    const { paradas, kmTotal } = montarRoteiro([
      parada('a', 'Blumenau'),
      parada('b', 'Pomerode'),
      parada('c', 'blumenau'),
    ]);

    expect(paradas.map((item) => item.id)).toEqual(['a', 'c', 'b']);
    expect(paradas[1]).toMatchObject({ id: 'c', mesmaCidade: true, kmDesdeAnterior: 0 });
    expect(kmTotal).toBe(paradas[2]?.kmDesdeAnterior);
  });

  it('sem paradas, roteiro vazio', () => {
    expect(montarRoteiro([])).toEqual({ paradas: [], foraDoRoteiro: 0, kmTotal: 0 });
  });
});

describe('linkGoogleMaps', () => {
  it('origem na primeira, destino na última e as do meio como waypoints separados por %7C, com os endereços completos', () => {
    const link = linkGoogleMaps([
      parada('a', 'Blumenau', 'Rua A, 10 / Sala 2 & Fundos'),
      parada('b', 'Gaspar', 'Rua B, 20'),
      parada('c', 'Pomerode', 'Rua C, 30'),
      parada('d', 'Jaraguá do Sul', 'Rua D, 40'),
    ]);

    const enc = encodeURIComponent;
    expect(link).toBe(
      'https://www.google.com/maps/dir/?api=1' +
        `&origin=${enc('Rua A, 10 / Sala 2 & Fundos — Blumenau/SC')}` +
        `&destination=${enc('Rua D, 40 — Jaraguá do Sul/SC')}` +
        `&waypoints=${enc('Rua B, 20 — Gaspar/SC')}%7C${enc('Rua C, 30 — Pomerode/SC')}` +
        '&travelmode=driving',
    );
    expect(link).toContain('origin=Rua%20A%2C%2010%20%2F%20Sala%202%20%26%20Fundos');
  });

  it('endereço que já traz a cidade vai como está, sem repetir a cidade', () => {
    const link = linkGoogleMaps([
      parada('a', 'Joinville', 'Rua do Príncipe, 800 - Centro, Joinville/SC'),
      parada('b', 'São Bento do Sul', 'Rua XV de Novembro, 900'),
    ]);

    expect(link).toContain(`origin=${encodeURIComponent('Rua do Príncipe, 800 - Centro, Joinville/SC')}&`);
    expect(link).toContain(`destination=${encodeURIComponent('Rua XV de Novembro, 900 — São Bento do Sul/SC')}&`);
  });

  it('a cidade só conta no fim do endereço: "Rua Blumenau, 50" de Gaspar ganha a cidade', () => {
    expect(enderecoCompleto({ endereco: 'Rua Blumenau, 50', cidade: 'Gaspar' })).toBe('Rua Blumenau, 50 — Gaspar/SC');
    expect(enderecoCompleto({ endereco: 'Rua Blumenau, 50', cidade: 'Blumenau' })).toBe(
      'Rua Blumenau, 50 — Blumenau/SC',
    );
    expect(enderecoCompleto({ endereco: 'Rua das Flores, 9 - Itaitá', cidade: 'Itá' })).toBe(
      'Rua das Flores, 9 - Itaitá — Itá/SC',
    );
  });

  it('endereço que termina com a cidade, com ou sem "/SC" ou " - SC", não repete a cidade', () => {
    for (const endereco of [
      'Rua do Príncipe, 120 — Joinville/SC',
      'Rua do Príncipe, 120 — Joinville',
      'Rua do Príncipe, 120 - Centro, JOINVILLE - SC',
      'Rua do Príncipe, 120 - Centro, Joinville / SC.',
    ]) {
      expect(enderecoCompleto({ endereco, cidade: 'Joinville' })).toBe(endereco);
    }
    const doSeed = 'Rua Reinoldo Rau, 220 - Centro, Jaraguá do Sul/SC';
    expect(enderecoCompleto({ endereco: doSeed, cidade: 'Jaragua do Sul' })).toBe(doSeed);
  });

  it('com uma parada só, o destino é ela, sem waypoints (a origem fica com a localização do aparelho)', () => {
    const link = linkGoogleMaps([parada('a', 'Blumenau', 'Rua A, 10')]);

    expect(link).toBe(
      `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent('Rua A, 10 — Blumenau/SC')}&travelmode=driving`,
    );
    expect(link).not.toContain('waypoints');
  });
});
