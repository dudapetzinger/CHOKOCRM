/**
 * Template puro da mensagem de consulta de estoque (UC12) e do link do
 * WhatsApp gerado a partir dela. Sem I/O: apenas montagem de texto.
 */
export type DadosDoTemplate = {
  nomeContato: string | null;
  nomeFantasia: string;
  nomeRepresentante: string;
  evento: { nome: string; produtosSugeridos: string[] } | null;
};

/**
 * Junta os produtos com vírgula e "e" antes do último item (sem depender de
 * locale). Lista vazia retorna `''` — quem chama deve tratar esse caso (ver
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
 * tratado como se não houvesse evento — o cliente nunca deve receber
 * "estoque de  na loja" com a lista de produtos vazia.
 */
export function montarMensagemDeEstoque(dados: DadosDoTemplate): string {
  const contato = dados.nomeContato ?? 'cliente';

  if (dados.evento && dados.evento.produtosSugeridos.length > 0) {
    const produtos = listarProdutos(dados.evento.produtosSugeridos);
    return `Olá, ${contato}! Aqui é ${dados.nomeRepresentante}, da Chokolaten. ${dados.evento.nome} está chegando — como está o estoque de ${produtos} na ${dados.nomeFantasia}? Posso preparar uma reposição. 🍫`;
  }

  return `Olá, ${contato}! Aqui é ${dados.nomeRepresentante}, da Chokolaten. Como está o estoque de chocolates na ${dados.nomeFantasia}? Posso preparar uma reposição. 🍫`;
}

/**
 * Normaliza um telefone para o formato exigido pelo `wa.me`: só dígitos, com
 * DDI 55. Prefixa `55` quando vêm 10–11 dígitos (DDD + número, sem DDI);
 * mantém como está quando já vêm 12–13 dígitos começando com `55`.
 */
export function normalizarTelefone(telefone: string): string {
  const digitos = telefone.replace(/\D/g, '');

  if (digitos.length >= 10 && digitos.length <= 11) {
    return `55${digitos}`;
  }

  if (digitos.length >= 12 && digitos.length <= 13 && digitos.startsWith('55')) {
    return digitos;
  }

  throw new Error('Telefone inválido');
}

/** Monta o link `wa.me` com o telefone normalizado e o texto codificado. */
export function montarLinkWhatsapp(telefone: string, texto: string): string {
  return `https://wa.me/${normalizarTelefone(telefone)}?text=${encodeURIComponent(texto)}`;
}
