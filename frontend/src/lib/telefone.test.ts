import { linkLigar, linkWhatsapp, somenteDigitos, telefoneDeTeste, telefoneParaWaMe } from './telefone';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('somenteDigitos', () => {
  it('tira tudo que não é dígito', () => {
    expect(somenteDigitos('(47) 99900-8080')).toBe('47999008080');
    expect(somenteDigitos('+55 47 3333-4444')).toBe('554733334444');
    expect(somenteDigitos('')).toBe('');
  });
});

describe('telefoneParaWaMe', () => {
  it('acrescenta o 55 a um número nacional (DDD + número)', () => {
    expect(telefoneParaWaMe('(47) 99900-8080')).toBe('5547999008080');
    expect(telefoneParaWaMe('(47) 3333-4444')).toBe('554733334444');
  });

  it('não duplica o 55 quando o número já vem com o código do país', () => {
    expect(telefoneParaWaMe('+55 (47) 99900-8080')).toBe('5547999008080');
    expect(telefoneParaWaMe('55 47 3333-4444')).toBe('554733334444');
  });

  it('trata DDD 55 (RS) sem o código do país como número nacional', () => {
    expect(telefoneParaWaMe('(55) 99999-8888')).toBe('5555999998888');
    expect(telefoneParaWaMe('(55) 3222-1111')).toBe('555532221111');
  });

  it('descarta um único zero de tronco antes do DDD', () => {
    expect(telefoneParaWaMe('047 99900-8080')).toBe('5547999008080');
    expect(telefoneParaWaMe('(047) 3333-4444')).toBe('554733334444');
    expect(telefoneParaWaMe('0')).toBe('');
  });

  it('devolve vazio quando não há dígitos', () => {
    expect(telefoneParaWaMe('')).toBe('');
    expect(telefoneParaWaMe('sem telefone')).toBe('');
  });
});

describe('linkWhatsapp', () => {
  it('monta o link com o texto codificado', () => {
    expect(linkWhatsapp('(47) 99900-8080', 'Olá, Marta! 🍫')).toBe(
      'https://wa.me/5547999008080?text=Ol%C3%A1%2C%20Marta!%20%F0%9F%8D%AB',
    );
  });

  it('sem texto, só o número', () => {
    expect(linkWhatsapp('(47) 99900-8080')).toBe('https://wa.me/5547999008080');
  });

  it('sem dígitos, vazio', () => {
    expect(linkWhatsapp('')).toBe('');
  });

  it('prefixo não geográfico (0800, 0300, 0500, 0900), vazio', () => {
    expect(linkWhatsapp('0800 123 4567', 'Oi')).toBe('');
    expect(linkWhatsapp('0300 313 1234')).toBe('');
  });

  it('sem DDD (8–9 dígitos), vazio', () => {
    expect(linkWhatsapp('3333-4444')).toBe('');
    expect(linkWhatsapp('99900-8080')).toBe('');
  });

  it('tamanho fora de 10–13 dígitos, ou 12–13 sem o 55, vazio', () => {
    expect(linkWhatsapp('+55 47 99900-80801')).toBe('');
    expect(linkWhatsapp('11 4733334444')).toBe('');
  });

  it('com zero de tronco, monta o link normalmente', () => {
    expect(linkWhatsapp('047 99900-8080', 'Oi')).toBe('https://wa.me/5547999008080?text=Oi');
  });
});

describe('linkLigar', () => {
  it('monta o link tel: com o número internacional', () => {
    expect(linkLigar('(47) 99900-8080')).toBe('tel:+5547999008080');
  });

  it('sem dígitos, vazio', () => {
    expect(linkLigar('')).toBe('');
  });
});

describe('telefone de teste (VITE_TELEFONE_DE_TESTE)', () => {
  it('sem a variável, não há telefone de teste e os links usam o telefone cadastrado', () => {
    vi.stubEnv('VITE_TELEFONE_DE_TESTE', '');
    expect(telefoneDeTeste()).toBe('');
    expect(linkWhatsapp('(47) 99900-8080')).toBe('https://wa.me/5547999008080');
    expect(linkLigar('(47) 3333-4444')).toBe('tel:+554733334444');
  });

  it('com a variável, os links de WhatsApp e de ligação vão para o telefone de teste', () => {
    vi.stubEnv('VITE_TELEFONE_DE_TESTE', ' (47) 99783-2223 ');
    expect(telefoneDeTeste()).toBe('(47) 99783-2223');
    expect(linkWhatsapp('(48) 3222-1111', 'Oi')).toBe('https://wa.me/5547997832223?text=Oi');
    expect(linkLigar('(48) 3222-1111')).toBe('tel:+5547997832223');
  });

  it('com a variável, um telefone cadastrado que não serve continua sem link', () => {
    vi.stubEnv('VITE_TELEFONE_DE_TESTE', '(47) 99783-2223');
    expect(linkWhatsapp('0800 123 4567')).toBe('');
    expect(linkWhatsapp('3333-4444')).toBe('');
    expect(linkLigar('')).toBe('');
  });

  it('com a variável inválida, nenhum link é montado, para não ligar ao cliente por engano', () => {
    vi.stubEnv('VITE_TELEFONE_DE_TESTE', '1234');
    expect(linkWhatsapp('(47) 99900-8080')).toBe('');
    expect(linkLigar('(47) 99900-8080')).toBe('');
  });
});
