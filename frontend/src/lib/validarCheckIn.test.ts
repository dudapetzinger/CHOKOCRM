import { errosDaApi, passoDoCampo, TITULO_DO_PASSO, validarPasso, type DadosDoCheckIn } from './validarCheckIn';

/** Um check-in válido em todos os passos; cada teste muda só o que confere. */
const VALIDO: DadosDoCheckIn = {
  dataHora: '2026-10-18T10:00',
  agora: '2026-10-18T13:30',
  novoContatoAberto: false,
  descricao: 'Reposição do mostruário.',
  proximaVisita: '2026-11-02',
  marcarProximaVisita: true,
  lembreteTexto: 'Levar amostras',
  lembreteData: '2026-11-02',
  anotarLembrete: true,
  hoje: '2026-10-18',
};

describe('validarCheckIn', () => {
  it('os títulos dos quatro passos', () => {
    expect(TITULO_DO_PASSO).toEqual({ 1: 'A visita', 2: 'Resultado', 3: 'O que aconteceu', 4: 'Próximos passos' });
  });

  it('um check-in válido não tem erro em nenhum passo', () => {
    for (const passo of [1, 2, 3, 4] as const) expect(validarPasso(passo, VALIDO)).toEqual({});
  });

  it('passo 1: sem data e hora', () => {
    expect(validarPasso(1, { ...VALIDO, dataHora: '' })).toEqual({ dataHora: 'Informe a data e a hora da visita.' });
  });

  it('passo 1: data e hora no futuro (mesma mensagem do backend)', () => {
    expect(validarPasso(1, { ...VALIDO, dataHora: '2026-10-18T13:31' })).toEqual({
      dataHora: 'Data e hora da visita não podem estar no futuro.',
    });
    expect(validarPasso(1, { ...VALIDO, dataHora: '2026-10-18T13:30' })).toEqual({});
  });

  it('passo 1: contato novo aberto, com a mensagem no campo do contato', () => {
    expect(validarPasso(1, { ...VALIDO, novoContatoAberto: true })).toEqual({
      contato: 'Adicione ou cancele o contato novo antes de salvar.',
    });
  });

  it('passo 2: o resultado não tem erro (o pedido vazio vale)', () => {
    expect(validarPasso(2, { ...VALIDO, dataHora: '', descricao: '' })).toEqual({});
  });

  it('passo 3: descrição com menos de 3 caracteres (sem contar os espaços das pontas)', () => {
    expect(validarPasso(3, { ...VALIDO, descricao: '  ok  ' })).toEqual({
      descricao: 'Descreva a visita com pelo menos 3 caracteres.',
    });
    expect(validarPasso(3, { ...VALIDO, descricao: 'ok!' })).toEqual({});
  });

  it('cada passo confere só os seus campos', () => {
    const tudoErrado: DadosDoCheckIn = {
      ...VALIDO,
      dataHora: '',
      descricao: '',
      proximaVisita: '2026-10-17',
      lembreteData: '',
    };
    expect(Object.keys(validarPasso(1, tudoErrado))).toEqual(['dataHora']);
    expect(Object.keys(validarPasso(3, tudoErrado))).toEqual(['descricao']);
    expect(Object.keys(validarPasso(4, tudoErrado))).toEqual(['proximaVisita', 'lembrete']);
  });

  it('passo 4: próxima visita marcada antes de hoje', () => {
    expect(validarPasso(4, { ...VALIDO, proximaVisita: '2026-10-17', lembreteData: '2026-10-20' })).toEqual({
      proximaVisita: 'A próxima visita não pode ser antes de hoje.',
    });
    expect(validarPasso(4, { ...VALIDO, proximaVisita: '2026-10-18' })).toEqual({});
  });

  it('passo 4: com "não" na próxima visita, a data não é conferida; "sim" sem data também vale', () => {
    expect(validarPasso(4, { ...VALIDO, marcarProximaVisita: false, proximaVisita: '2026-10-17' })).toEqual({});
    expect(validarPasso(4, { ...VALIDO, proximaVisita: '' })).toEqual({});
  });

  it('passo 4: lembrete com texto e sem data', () => {
    expect(validarPasso(4, { ...VALIDO, lembreteData: '' })).toEqual({ lembrete: 'Informe a data do lembrete.' });
  });

  it('passo 4: lembrete com data antes de hoje', () => {
    expect(validarPasso(4, { ...VALIDO, lembreteData: '2026-10-17' })).toEqual({
      lembrete: 'A data do lembrete não pode ser antes de hoje.',
    });
  });

  it('passo 4: lembrete sem texto, ou com "não", não é conferido', () => {
    expect(validarPasso(4, { ...VALIDO, lembreteTexto: '   ', lembreteData: '' })).toEqual({});
    expect(validarPasso(4, { ...VALIDO, anotarLembrete: false, lembreteData: '2026-10-17' })).toEqual({});
  });

  it('passoDoCampo: o passo de cada campo', () => {
    expect(passoDoCampo('dataHora')).toBe(1);
    expect(passoDoCampo('contato')).toBe(1);
    expect(passoDoCampo('descricao')).toBe(3);
    expect(passoDoCampo('proximaVisita')).toBe(4);
    expect(passoDoCampo('lembrete')).toBe(4);
  });

  it('errosDaApi: os `details` do 400 (zod, `{ path, message }`) viram erros nos campos', () => {
    expect(
      errosDaApi([
        { path: 'dataHora', message: 'Data e hora da visita não podem estar no futuro.' },
        { path: 'lembrete.data', message: 'A data do lembrete não pode ser antes de hoje.' },
      ]),
    ).toEqual({
      erros: {
        dataHora: 'Data e hora da visita não podem estar no futuro.',
        lembrete: 'A data do lembrete não pode ser antes de hoje.',
      },
      restantes: [],
    });
    expect(
      errosDaApi([
        { path: 'contactId', message: 'Identificador do contato inválido.' },
        { path: 'descricao', message: 'Descrição curta.' },
        { path: 'proximaVisita', message: 'Data da próxima visita inválida.' },
        { path: 'proximaCampanhaId', message: 'Identificador da campanha inválido.' },
      ]).erros,
    ).toEqual({
      contato: 'Identificador do contato inválido.',
      descricao: 'Descrição curta.',
      proximaVisita: 'Data da próxima visita inválida.',
    });
  });

  it('errosDaApi: o que não é de um campo fica nas mensagens restantes', () => {
    expect(
      errosDaApi([
        { path: 'campanhaId', message: 'Identificador da campanha inválido.' },
        { path: 'dataHora', message: 'Data e hora da visita inválidas.' },
      ]),
    ).toEqual({
      erros: { dataHora: 'Data e hora da visita inválidas.' },
      restantes: ['Identificador da campanha inválido.'],
    });
    expect(errosDaApi(undefined)).toEqual({ erros: {}, restantes: [] });
    expect(errosDaApi('texto')).toEqual({ erros: {}, restantes: [] });
  });
});
