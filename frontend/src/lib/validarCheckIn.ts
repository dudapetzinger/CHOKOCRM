/**
 * Validação do check-in em quatro passos (Etapa 10b, spec 5): cada passo
 * confere só os seus campos, com as mesmas regras e mensagens de antes do
 * passo a passo (e as do `visit.schema.ts` do backend onde ele confere o
 * mesmo). O "Continuar" valida o passo em que está; o "Salvar", o passo 4 —
 * os anteriores já passaram pelo "Continuar" e não mudam fora da tela deles.
 *
 * `errosDaApi` traduz os `details` do 400 do backend (zod: `{ path, message }`
 * por problema, ver `errorHandler.ts`) para os campos da tela; com
 * `passoDoCampo`, a página volta ao passo do campo com a mensagem nele.
 */

export type Passo = 1 | 2 | 3 | 4;

export const TITULO_DO_PASSO: Record<Passo, string> = {
  1: 'A visita',
  2: 'Resultado',
  3: 'O que aconteceu',
  4: 'Próximos passos',
};

export type Erros = Partial<Record<'dataHora' | 'contato' | 'descricao' | 'proximaVisita' | 'lembrete', string>>;

/**
 * O que a validação precisa do formulário. Datas como nos campos:
 * `dataHora` e `agora` em `AAAA-MM-DDTHH:mm` (fuso do dispositivo),
 * `proximaVisita`, `lembreteData` e `hoje` em `AAAA-MM-DD` — a comparação
 * de texto basta.
 */
export type DadosDoCheckIn = {
  dataHora: string;
  agora: string;
  novoContatoAberto: boolean;
  descricao: string;
  proximaVisita: string;
  marcarProximaVisita: boolean;
  lembreteTexto: string;
  lembreteData: string;
  anotarLembrete: boolean;
  hoje: string;
};

export function validarPasso(passo: Passo, dados: DadosDoCheckIn): Erros {
  const erros: Erros = {};

  if (passo === 1) {
    if (!dados.dataHora) erros.dataHora = 'Informe a data e a hora da visita.';
    else if (dados.dataHora > dados.agora) erros.dataHora = 'Data e hora da visita não podem estar no futuro.';
    // O contato digitado e não adicionado se perderia em silêncio
    if (dados.novoContatoAberto) erros.contato = 'Adicione ou cancele o contato novo antes de salvar.';
  }

  if (passo === 3 && dados.descricao.trim().length < 3) {
    erros.descricao = 'Descreva a visita com pelo menos 3 caracteres.';
  }

  if (passo === 4) {
    // "Sim" sem data vale: vai como sem data, e a agenda segue a recorrência
    if (dados.marcarProximaVisita && dados.proximaVisita && dados.proximaVisita < dados.hoje) {
      erros.proximaVisita = 'A próxima visita não pode ser antes de hoje.';
    }
    if (dados.anotarLembrete && dados.lembreteTexto.trim()) {
      if (!dados.lembreteData) erros.lembrete = 'Informe a data do lembrete.';
      else if (dados.lembreteData < dados.hoje) erros.lembrete = 'A data do lembrete não pode ser antes de hoje.';
    }
  }

  return erros;
}

const PASSO_DO_CAMPO: Record<keyof Erros, Passo> = {
  dataHora: 1,
  contato: 1,
  descricao: 3,
  proximaVisita: 4,
  lembrete: 4,
};

export function passoDoCampo(campo: keyof Erros): Passo {
  return PASSO_DO_CAMPO[campo];
}

/** Primeiro trecho do `path` do zod → campo da tela (`lembrete.data` → `lembrete`). */
const CAMPO_DO_CORPO: Record<string, keyof Erros> = {
  dataHora: 'dataHora',
  contactId: 'contato',
  descricao: 'descricao',
  proximaVisita: 'proximaVisita',
  lembrete: 'lembrete',
};

/**
 * Os `details` de um erro da API separados em erros de campo (o primeiro de
 * cada campo) e as mensagens que não são de um campo da tela (ex.: a
 * campanha), que ficam no aviso do envio. Fora do formato, nada.
 */
export function errosDaApi(details: unknown): { erros: Erros; restantes: string[] } {
  const erros: Erros = {};
  const restantes: string[] = [];
  if (!Array.isArray(details)) return { erros, restantes };

  for (const item of details) {
    if (!item || typeof item !== 'object' || typeof (item as { message?: unknown }).message !== 'string') continue;
    const { path, message } = item as { path?: unknown; message: string };
    const campo = typeof path === 'string' ? CAMPO_DO_CORPO[path.split('.')[0]!] : undefined;
    if (campo) erros[campo] ??= message;
    else restantes.push(message);
  }

  return { erros, restantes };
}
