/**
 * Template puro da mensagem de consulta de estoque. Sem I/O: apenas
 * montagem de texto.
 */
export type DadosDoTemplate = {
  nomeContato: string | null;
  nomeFantasia: string;
  nomeRepresentante: string;
  evento: { nome: string; produtosSugeridos: string[] } | null;
};

/** Ano no fim do nome do evento ("Natal 2026"). */
const REGEX_ANO_FINAL = / \d{4}$/;

/**
 * Nome do evento no template (sem o ano): o banco grava "Páscoa 2026", o
 * template recebe "Páscoa". Usado pela geração real e pelo seed.
 */
export function nomeDoEventoNoTemplate(nome: string): string {
  return nome.replace(REGEX_ANO_FINAL, '');
}

/**
 * Junta os produtos com vírgula e "e" antes do último item (sem depender de
 * locale). Lista vazia retorna `''`: quem chama deve tratar esse caso (ver
 * `montarMensagemDeEstoque`), nunca exibir a lista vazia ao cliente.
 */
export function listarProdutos(produtos: string[]): string {
  if (produtos.length === 0) {
    return '';
  }

  if (produtos.length === 1) {
    return produtos[0]!;
  }

  if (produtos.length === 2) {
    return `${produtos[0]} e ${produtos[1]}`;
  }

  const ultimo = produtos[produtos.length - 1];
  const demais = produtos.slice(0, -1);
  return `${demais.join(', ')} e ${ultimo}`;
}

/**
 * Monta o texto sugerido da mensagem de estoque, com ou sem evento sazonal
 * vigente. Um evento sem produtos sugeridos (`produtosSugeridos: []`) é
 * tratado como se não houvesse evento: o cliente nunca deve receber
 * "estoque de  na loja" com a lista de produtos vazia.
 */
export function montarMensagemDeEstoque(dados: DadosDoTemplate): string {
  const contato = dados.nomeContato ?? 'cliente';

  if (dados.evento && dados.evento.produtosSugeridos.length > 0) {
    const produtos = listarProdutos(dados.evento.produtosSugeridos);
    return `Olá, ${contato}! Aqui é ${dados.nomeRepresentante}, da Chokolaten. ${dados.evento.nome} está chegando. Como está o estoque de ${produtos} na ${dados.nomeFantasia}? Posso preparar uma reposição. 🍫`;
  }

  return `Olá, ${contato}! Aqui é ${dados.nomeRepresentante}, da Chokolaten. Como está o estoque de chocolates na ${dados.nomeFantasia}? Posso preparar uma reposição. 🍫`;
}
