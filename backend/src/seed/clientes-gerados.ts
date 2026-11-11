import { perfilDoErpId } from '../providers/erp/mock/gerador';
import { ROTAS, type DiaUtil } from './rotas';
import type { ClienteSeed, ContatoSeed } from './tipos';

/**
 * Clientes gerados da demonstração: completam as carteiras para cerca de 40
 * clientes por representante (24 da Eduarda e 30 do Rafael, além dos 26
 * âncoras de `demonstracao.ts`), para a rota de cada dia útil ter de 4 a 6
 * visitas. Tudo é determinístico pelo índice do cliente, sem sorteio: o mesmo
 * código gera sempre o mesmo cadastro.
 *
 * Cada cliente nasce de uma vaga da grade (`GRADE`: dia da rota,
 * recorrência e fase, balanceadas junto com os âncoras — ver `rotas.ts`); a
 * cidade é uma das cidades daquele dia da rota; o tipo do negócio segue a
 * recorrência (semanais são padarias, mercearias, cafés; os de 28 dias,
 * pousadas, lojas de presentes, casas de chá). Cadastro de sistema de
 * verdade: nome fantasia de bairro ou de família, razão social diferente
 * (Ltda/ME/EPP), CNPJ com dígitos verificadores válidos, endereço em rua da
 * cidade, telefone fixo `(47) 3xxx-xxxx` único, e-mail no domínio do
 * cliente, de 1 a 2 contatos com cargo e um principal (nome completo que
 * não se repete em nenhum outro cliente), e `erpId` de 5
 * dígitos escolhido varrendo os códigos com `perfilDoErpId` para que o ERP
 * simulado dê 0 meses sem compra (nenhum gerado é rebaixado pela venda).
 */

export type TipoDeCliente =
  'padaria' | 'cafe' | 'confeitaria' | 'emporio' | 'mercearia' | 'casaDeCha' | 'hotel' | 'restaurante' | 'presentes';

type Vaga = readonly [dia: DiaUtil, recorrenciaDias: number, fase: number];

const EMAIL_EDUARDA = 'eduarda@chokolaten.com.br';
const EMAIL_RAFAEL = 'rafael@chokolaten.com.br';

/** Vagas da grade de cada carteira (dia, recorrência, fase), balanceadas com os âncoras. */
const GRADE: Record<string, readonly Vaga[]> = {
  [EMAIL_EDUARDA]: [
    [1, 7, 0],
    [1, 7, 0],
    [1, 14, 0],
    [1, 14, 0],
    [1, 14, 1],
    [1, 14, 1],
    [2, 7, 0],
    [2, 7, 0],
    [2, 14, 0],
    [2, 14, 0],
    [2, 14, 1],
    [3, 7, 0],
    [3, 7, 0],
    [3, 7, 0],
    [3, 28, 2],
    [4, 7, 0],
    [4, 7, 0],
    [4, 7, 0],
    [4, 14, 1],
    [4, 28, 2],
    [5, 7, 0],
    [5, 7, 0],
    [5, 7, 0],
    [5, 28, 1],
  ],
  [EMAIL_RAFAEL]: [
    [1, 7, 0],
    [1, 7, 0],
    [1, 7, 0],
    [1, 14, 0],
    [1, 14, 0],
    [1, 14, 1],
    [1, 14, 1],
    [2, 7, 0],
    [2, 7, 0],
    [2, 7, 0],
    [2, 7, 0],
    [2, 14, 0],
    [2, 28, 3],
    [3, 7, 0],
    [3, 7, 0],
    [3, 7, 0],
    [3, 14, 0],
    [3, 14, 1],
    [3, 14, 1],
    [4, 7, 0],
    [4, 7, 0],
    [4, 7, 0],
    [4, 14, 0],
    [4, 28, 0],
    [4, 28, 1],
    [4, 28, 3],
    [5, 7, 0],
    [5, 7, 0],
    [5, 7, 0],
    [5, 14, 1],
  ],
};

/** Tipo do negócio pela recorrência: quem compra toda semana é padaria, mercearia, café… */
const TIPOS_POR_RECORRENCIA: Record<number, readonly TipoDeCliente[]> = {
  7: ['padaria', 'mercearia', 'cafe', 'confeitaria', 'padaria', 'restaurante', 'cafe', 'mercearia'],
  14: ['confeitaria', 'emporio', 'cafe', 'restaurante', 'casaDeCha', 'presentes'],
  28: ['hotel', 'presentes', 'casaDeCha', 'emporio'],
};

const PREFIXOS: Record<TipoDeCliente, readonly string[]> = {
  padaria: ['Padaria', 'Panificadora'],
  cafe: ['Café', 'Cafeteria'],
  confeitaria: ['Confeitaria', 'Doceria'],
  emporio: ['Empório', 'Armazém'],
  mercearia: ['Mercearia', 'Mercado'],
  casaDeCha: ['Casa de Chá', 'Casa de Chá'],
  hotel: ['Pousada', 'Hotel'],
  restaurante: ['Restaurante', 'Pizzaria'],
  presentes: ['Presentes', 'Casa de Presentes'],
};

const ATIVIDADE: Record<TipoDeCliente, string> = {
  padaria: 'Panificação',
  cafe: 'Cafeteria',
  confeitaria: 'Confeitaria e Doces',
  emporio: 'Comércio de Alimentos',
  mercearia: 'Mercearia',
  casaDeCha: 'Casa de Chá',
  hotel: 'Hotelaria e Turismo',
  restaurante: 'Restaurante',
  presentes: 'Comércio de Presentes',
};

const SUFIXOS = ['Ltda', 'ME', 'Ltda', 'EPP'] as const;

type Cidade = {
  bairros: readonly string[];
  ruas: readonly string[];
  prefixosFone: readonly string[];
};

/** Bairros, ruas e prefixos de telefone fixo de cada cidade das rotas. */
const CIDADES: Record<string, Cidade> = {
  Joinville: {
    bairros: ['Glória', 'Floresta', 'Costa e Silva', 'Saguaçu', 'Iririú', 'Atiradores', 'Bucarein', 'Anita Garibaldi'],
    ruas: [
      'Rua Blumenau',
      'Rua Max Colin',
      'Rua Ministro Calógeras',
      'Avenida Getúlio Vargas',
      'Rua Visconde de Taunay',
      'Rua Inácio Bastos',
    ],
    prefixosFone: ['3422', '3433', '3026', '3435'],
  },
  'Jaraguá do Sul': {
    bairros: ['Czerniewicz', 'Amizade', 'Ilha da Figueira', 'Nova Brasília', 'Barra do Rio Cerro', 'Jaraguá Esquerdo'],
    ruas: [
      'Rua Walter Marquardt',
      'Avenida Marechal Deodoro da Fonseca',
      'Rua Joinville',
      'Rua Expedicionário Gumercindo da Silva',
      'Rua Presidente Epitácio Pessoa',
    ],
    prefixosFone: ['3275', '3371', '3372'],
  },
  Pomerode: {
    bairros: ['Testo Central', 'Ribeirão Herdt', 'Pomerode Fundos', 'Rega'],
    ruas: ['Rua Hermann Weege', 'Rua Luiz Abry', 'Rua Dr. Wunderwald', 'Rua Pastor Ziegler'],
    prefixosFone: ['3387', '3395'],
  },
  Corupá: {
    bairros: ['Ano Bom', 'Seminário', 'Itapocu'],
    ruas: ['Rua Nereu Ramos', 'Avenida Getúlio Vargas', 'Rua Roberto Seidel'],
    prefixosFone: ['3375'],
  },
  'São Bento do Sul': {
    bairros: ['Mato Preto', 'Oxford', 'Centenário', 'Boehmerwald', 'Lençol'],
    ruas: [
      'Rua Felipe Schmidt',
      'Avenida São Bento',
      'Rua Jorge Lacerda',
      'Rua Capitão Ernesto Nunes',
      'Rua Antônio Kaesemodel',
    ],
    prefixosFone: ['3633', '3635', '3626'],
  },
  Blumenau: {
    bairros: [
      'Garcia',
      'Velha',
      'Ponta Aguda',
      'Fortaleza',
      'Victor Konder',
      'Salto do Norte',
      'Vorstadt',
      'Água Verde',
    ],
    ruas: [
      'Rua Amazonas',
      'Rua São Paulo',
      'Rua Antônio da Veiga',
      'Rua Hermann Hering',
      'Rua Bahia',
      'Rua 7 de Setembro',
    ],
    prefixosFone: ['3322', '3035', '3326', '3340'],
  },
  Indaial: {
    bairros: ['Estradinha', 'Warnow', 'Encano', 'Tapajós'],
    ruas: ['Rua Marechal Floriano Peixoto', 'Avenida Getúlio Vargas', 'Rua Tiradentes'],
    prefixosFone: ['3333', '3394'],
  },
  Timbó: {
    bairros: ['Quintino', 'Dona Clara', 'Imigrantes', 'Padre Martinho Stein'],
    ruas: ['Avenida Getúlio Vargas', 'Rua Sete de Setembro', 'Rua Duque de Caxias'],
    prefixosFone: ['3382', '3399'],
  },
  Brusque: {
    bairros: ['Azambuja', 'Santa Terezinha', 'Águas Claras', 'Jardim Maluche', 'Steffen', 'São Luiz'],
    ruas: ['Avenida Cônsul Carlos Renaux', 'Rua Hercílio Luz', 'Rua Azambuja', 'Avenida Primeiro de Maio'],
    prefixosFone: ['3351', '3355', '3396'],
  },
  Itajaí: {
    bairros: ['Fazenda', 'Cabeçudas', 'São Vicente', 'Cordeiros', 'Praia Brava', 'Dom Bosco', 'Vila Operária'],
    ruas: ['Avenida Joca Brandão', 'Rua Brusque', 'Avenida Sete de Setembro', 'Rua Lauro Müller', 'Rua Uruguai'],
    prefixosFone: ['3348', '3344', '3249'],
  },
  'Rio do Sul': {
    bairros: ['Canta Galo', 'Budag', 'Jardim América', 'Laranjeiras', 'Navegantes', 'Santana'],
    ruas: ['Avenida Oscar Barcelos', 'Rua Dom Bosco', 'Avenida Aristiliano Ramos', 'Rua XV de Novembro'],
    prefixosFone: ['3521', '3525', '3531'],
  },
};

/** Famílias da região (colonização alemã e italiana e as de sempre). */
const SOBRENOMES = [
  'Kuhn',
  'Ehlert',
  'Hoffmann',
  'Zimmermann',
  'Wachholz',
  'Krüger',
  'Schroeder',
  'Pasold',
  'Rossi',
  'Moser',
  'Bertoldi',
  'Tomio',
  'Fronza',
  'Gaulke',
  'Raduenz',
  'Lenz',
  'Vieira',
  'Pereira',
  'Correa',
  'Machado',
  'Schwarz',
  'Volpi',
  'Berndt',
  'Tessmann',
  'Beduschi',
  'Klitzke',
  'Mafra',
  'Dalcastagnè',
  'Marquardt',
  'Siewert',
  'Günther',
  'Hasse',
  'Bauer',
  'Darolt',
  'Tormena',
  'Schmitz',
  'Purnhagen',
] as const;

type Pessoa = { nome: string; feminino: boolean };

const PRENOMES: readonly Pessoa[] = [
  { nome: 'Juliana', feminino: true },
  { nome: 'Marcos', feminino: false },
  { nome: 'Patrícia', feminino: true },
  { nome: 'André', feminino: false },
  { nome: 'Luciana', feminino: true },
  { nome: 'Gustavo', feminino: false },
  { nome: 'Camila', feminino: true },
  { nome: 'Rodrigo', feminino: false },
  { nome: 'Tatiane', feminino: true },
  { nome: 'Fábio', feminino: false },
  { nome: 'Simone', feminino: true },
  { nome: 'Leandro', feminino: false },
  { nome: 'Daniela', feminino: true },
  { nome: 'Rogério', feminino: false },
  { nome: 'Karin', feminino: true },
  { nome: 'Edson', feminino: false },
  { nome: 'Vanessa', feminino: true },
  { nome: 'Cláudio', feminino: false },
  { nome: 'Helena', feminino: true },
  { nome: 'Márcio', feminino: false },
  { nome: 'Adriana', feminino: true },
  { nome: 'Sérgio', feminino: false },
  { nome: 'Mônica', feminino: true },
];

/** Cargo [masculino, feminino] do contato principal e do segundo, por tipo de negócio. */
const CARGOS: Record<
  TipoDeCliente,
  readonly [principal: readonly [string, string], segundo: readonly [string, string]]
> = {
  padaria: [
    ['Proprietário', 'Proprietária'],
    ['Gerente', 'Gerente'],
  ],
  cafe: [
    ['Gerente', 'Gerente'],
    ['Sócio', 'Sócia'],
  ],
  confeitaria: [
    ['Proprietário', 'Proprietária'],
    ['Chef confeiteiro', 'Chef confeiteira'],
  ],
  emporio: [
    ['Sócio', 'Sócia'],
    ['Comprador', 'Compradora'],
  ],
  mercearia: [
    ['Gerente de Compras', 'Gerente de Compras'],
    ['Proprietário', 'Proprietária'],
  ],
  casaDeCha: [
    ['Proprietário', 'Proprietária'],
    ['Gerente', 'Gerente'],
  ],
  hotel: [
    ['Gerente de A&B', 'Gerente de A&B'],
    ['Comprador', 'Compradora'],
  ],
  restaurante: [
    ['Proprietário', 'Proprietária'],
    ['Chef de cozinha', 'Chef de cozinha'],
  ],
  presentes: [
    ['Proprietário', 'Proprietária'],
    ['Vendedor', 'Vendedora'],
  ],
};

/** CNPJ real da parceira, usado nos testes de importação: nenhum gerado pode colidir com ele. */
const CNPJ_DA_PARCEIRA = '25382906000149';

function escolher<T>(lista: readonly T[], indice: number): T {
  return lista[indice % lista.length] as T;
}

/** Sem acento, minúsculo, só letras e números (domínio e caixa de e-mail). */
function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function digitoVerificador(digitos: string, pesos: readonly number[]): number {
  const soma = pesos.reduce((total, peso, indice) => total + Number(digitos[indice]) * peso, 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

/** CNPJ de matriz (`/0001`) com os dois dígitos verificadores pelo algoritmo oficial. */
export function cnpjComDigitos(raiz: string): string {
  const base = `${raiz}0001`;
  const primeiro = digitoVerificador(base, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digitoVerificador(`${base}${primeiro}`, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return `${base}${primeiro}${segundo}`;
}

/** Número de endereço com separador de milhar, como nos âncoras ("1.480"). */
function numeroDoEndereco(indice: number): string {
  const numero = 40 + ((indice * 379) % 2900);
  return numero >= 1000 ? `${Math.floor(numero / 1000)}.${String(numero % 1000).padStart(3, '0')}` : String(numero);
}

/**
 * `erpId`s dos gerados: varre a partir de 12201 (acima dos códigos dos
 * âncoras), com passos irregulares (como numeração de cadastro de verdade),
 * e só aceita código cujo perfil no ERP simulado tenha 0 meses sem compra.
 */
function erpIdsCalibrados(quantidade: number): string[] {
  const codigos: string[] = [];
  let candidato = 12201;
  let passo = 0;
  while (codigos.length < quantidade) {
    const codigo = String(candidato);
    if (perfilDoErpId(codigo).mesesSemCompra === 0) codigos.push(codigo);
    passo += 1;
    candidato += 11 + ((passo * 29) % 53);
  }
  return codigos;
}

/**
 * Gera os clientes da grade. `nomesDeContatoReservados`: nomes completos de
 * contato que nenhum gerado pode repetir (os dos âncoras, que ficam em
 * `demonstracao.ts`); entre os gerados, o nome completo de cada contato
 * também é único.
 */
export function gerarClientes(nomesDeContatoReservados: ReadonlySet<string> = new Set()): ClienteSeed[] {
  const vagas = Object.entries(GRADE).flatMap(([representanteEmail, lista]) =>
    lista.map((vaga) => ({ representanteEmail, vaga })),
  );
  const erpIds = erpIdsCalibrados(vagas.length);
  const nomesUsados = new Set<string>();
  const fonesUsados = new Set<string>();
  const contatosUsados = new Set<string>(nomesDeContatoReservados);
  /** Primeira pessoa da lista, a partir de `inicio`, cujo nome completo com o sobrenome ainda não foi usado. */
  const pessoaSemRepetir = (inicio: number, sobrenomeDaPessoa: string): Pessoa => {
    for (let tentativa = 0; tentativa < PRENOMES.length; tentativa++) {
      const pessoa = escolher(PRENOMES, inicio + tentativa);
      const nome = `${pessoa.nome} ${sobrenomeDaPessoa}`;
      if (!contatosUsados.has(nome)) {
        contatosUsados.add(nome);
        return pessoa;
      }
    }
    throw new Error(`Sem prenome livre para o sobrenome ${sobrenomeDaPessoa}.`);
  };
  const porDia = new Map<string, number>();
  const porRecorrencia = new Map<string, number>();
  const porCidade = new Map<string, number>();

  return vagas.map(({ representanteEmail, vaga: [dia, recorrenciaDias, fase] }, indice) => {
    const chaveDoDia = `${representanteEmail}|${dia}`;
    const ordemNoDia = porDia.get(chaveDoDia) ?? 0;
    porDia.set(chaveDoDia, ordemNoDia + 1);
    const cidadesDoDia = (ROTAS[representanteEmail] as Record<DiaUtil, readonly string[]>)[dia];
    const cidade = escolher(cidadesDoDia, ordemNoDia);
    const dadosDaCidade = CIDADES[cidade] as Cidade;
    const ordemNaCidade = porCidade.get(cidade) ?? 0;
    porCidade.set(cidade, ordemNaCidade + 1);

    const chaveDaRecorrencia = `${representanteEmail}|${recorrenciaDias}`;
    const ordemNaRecorrencia = porRecorrencia.get(chaveDaRecorrencia) ?? 0;
    porRecorrencia.set(chaveDaRecorrencia, ordemNaRecorrencia + 1);
    const tipo = escolher(
      TIPOS_POR_RECORRENCIA[recorrenciaDias] as readonly TipoDeCliente[],
      ordemNaRecorrencia + (representanteEmail === EMAIL_RAFAEL ? 1 : 0),
    );

    const sobrenome = escolher(SOBRENOMES, indice * 7 + 3);
    const bairro = escolher(dadosDaCidade.bairros, ordemNaCidade);
    // Nome fantasia de bairro ou de família, alternando; sem repetir nome.
    let nomeFantasia = '';
    for (let tentativa = 0; nomeFantasia === '' || nomesUsados.has(nomeFantasia); tentativa++) {
      const prefixo = escolher(PREFIXOS[tipo], indice + tentativa);
      const raiz = (indice + tentativa) % 2 === 0 ? bairro : escolher(SOBRENOMES, indice * 7 + 3 + tentativa);
      nomeFantasia = `${prefixo} ${raiz}`;
    }
    nomesUsados.add(nomeFantasia);

    const dominio = `${semAcento(nomeFantasia)}.com.br`;
    const sufixo = escolher(SUFIXOS, indice);
    const socio = escolher(SOBRENOMES, indice * 7 + 8 + Math.floor(indice / SOBRENOMES.length) * 3);
    const razaoSocial =
      indice % 3 === 0 && socio !== sobrenome
        ? `${sobrenome} & ${socio} ${ATIVIDADE[tipo]} ${sufixo}`
        : `${escolher(PRENOMES, indice).nome.charAt(0)}. ${sobrenome} ${ATIVIDADE[tipo]} ${sufixo}`;

    let telefone = '';
    for (let tentativa = 0; telefone === '' || fonesUsados.has(telefone); tentativa++) {
      const prefixoFone = escolher(dadosDaCidade.prefixosFone, indice + tentativa);
      const final = 1000 + ((indice * 3571 + tentativa * 613 + 2087) % 9000);
      telefone = `(47) ${prefixoFone}-${final}`;
    }
    fonesUsados.add(telefone);

    const contatos: ContatoSeed[] = [];
    const [cargoPrincipal, cargoSegundo] = CARGOS[tipo];
    const pessoaPrincipal = pessoaSemRepetir(indice * 5 + 2, sobrenome);
    contatos.push({
      nome: `${pessoaPrincipal.nome} ${sobrenome}`,
      cargo: pessoaPrincipal.feminino ? cargoPrincipal[1] : cargoPrincipal[0],
      telefone: `(47) 9${9 - (indice % 2)}${String(100 + ((indice * 457) % 900))}-${String(1000 + ((indice * 7919) % 9000))}`,
      email: `${semAcento(pessoaPrincipal.nome)}.${semAcento(sobrenome)}@${dominio}`,
      principal: true,
    });
    if (indice % 3 !== 1) {
      const sobrenomeDoSegundo = indice % 2 === 0 ? sobrenome : socio;
      const pessoa = pessoaSemRepetir(indice * 5 + 9, sobrenomeDoSegundo);
      contatos.push({
        nome: `${pessoa.nome} ${sobrenomeDoSegundo}`,
        cargo: pessoa.feminino ? cargoSegundo[1] : cargoSegundo[0],
        telefone: `(47) 9${8 + (indice % 2)}${String(100 + ((indice * 613) % 900))}-${String(1000 + ((indice * 4721) % 9000))}`,
        email: `${semAcento(pessoa.nome)}.${semAcento(sobrenomeDoSegundo)}@${dominio}`,
        principal: false,
      });
    }

    let raizDoCnpj = 10_000_000 + (((indice + 1) * 7_368_421) % 89_000_000);
    while (cnpjComDigitos(String(raizDoCnpj)) === CNPJ_DA_PARCEIRA) raizDoCnpj += 1;

    return {
      razaoSocial,
      nomeFantasia,
      cnpj: cnpjComDigitos(String(raizDoCnpj)),
      cidade,
      endereco: `${escolher(dadosDaCidade.ruas, indice)}, ${numeroDoEndereco(indice)} - ${bairro}, ${cidade}/SC`,
      telefone,
      email: `contato@${dominio}`,
      contatos,
      erpId: erpIds[indice] as string,
      representanteEmail,
      recorrenciaDias,
      ativo: true,
      agenda: { dia, fase },
    };
  });
}

// `(?= |$)` em vez de `\b`: em JavaScript, `\b` não reconhece letra acentuada ("Café", "Chá").
const PADROES_DE_TIPO: readonly [RegExp, TipoDeCliente][] = [
  [/^(Padaria|Panificadora)(?= |$)/, 'padaria'],
  [/^Casa de Chás?(?= |$)/, 'casaDeCha'],
  [/^(Café|Cafeteria)(?= |$)/, 'cafe'],
  [/^(Confeitaria|Doceria)(?= |$)/, 'confeitaria'],
  [/^(Empório|Armazém)(?= |$)/, 'emporio'],
  [/^(Mercearia|Mercado)(?= |$)/, 'mercearia'],
  [/^(Hotel|Pousada)(?= |$)/, 'hotel'],
  [/^(Restaurante|Pizzaria)(?= |$)/, 'restaurante'],
  [/^(Presentes|Casa de Presentes)(?= |$)/, 'presentes'],
];

/** Tipo do negócio pelo nome fantasia (âncoras e gerados seguem os mesmos prefixos). */
export function tipoDoCliente(nomeFantasia: string): TipoDeCliente {
  return PADROES_DE_TIPO.find(([padrao]) => padrao.test(nomeFantasia))?.[1] ?? 'emporio';
}
