import type { Mensagem } from '../providers/email/EmailProvider';
import { VALIDADE_TOKEN_HORAS } from './redefinicao-senha.regras';

/**
 * Textos dos e-mails do app, em pt-BR, com versão em texto simples e um
 * HTML mínimo (spec da Etapa 8, 7.13). Funções puras: quem chama passa o
 * endereço do app (`APP_URL`) e o token; nada vem da requisição.
 */

const ASSUNTO_REDEFINICAO = 'Redefinição de senha do ChokoCRM';

const ENTIDADES_HTML: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

function escaparHtml(texto: string): string {
  return texto.replace(/[&<>"']/g, (caractere) => ENTIDADES_HTML[caractere] ?? caractere);
}

/**
 * `APP_URL/redefinir-senha#<token>`, sem barra dobrada se `APP_URL` terminar
 * em `/`. O token vai no fragmento: o navegador não o manda ao servidor nem
 * no `Referer`, então ele não aparece em log de requisição nem na telemetria.
 * A página do front lê `location.hash`.
 */
export function linkDeRedefinicao(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, '')}/redefinir-senha#${encodeURIComponent(token)}`;
}

export function emailDeRedefinicaoDeSenha(params: {
  para: string;
  nome: string;
  appUrl: string;
  token: string;
}): Mensagem {
  const link = linkDeRedefinicao(params.appUrl, params.token);
  const saudacao = `Olá, ${params.nome}.`;
  const pedido = 'O gestor do ChokoCRM pediu a redefinição da sua senha.';
  const instrucao = `Para criar uma senha nova, abra o link (vale por ${VALIDADE_TOKEN_HORAS} horas):`;

  return {
    para: params.para,
    assunto: ASSUNTO_REDEFINICAO,
    texto: `${saudacao} ${pedido} ${instrucao} ${link}`,
    html: [
      `<p>${escaparHtml(saudacao)}</p>`,
      `<p>${escaparHtml(pedido)}</p>`,
      `<p>${escaparHtml(instrucao)}<br><a href="${escaparHtml(link)}">${escaparHtml(link)}</a></p>`,
    ].join('\n'),
  };
}
