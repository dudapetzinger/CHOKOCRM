/**
 * Texto pronto da etiqueta de situação do cliente (Etapa 7, spec 5.1): diz em
 * palavras o que a cor quer dizer e há quanto tempo. Função pura.
 */
import { LIMIAR_SEM_COMPRA_DIAS } from '../config/classificacao';
import type { Cor } from '../services/clients';

type Situacao = {
  cor: Cor;
  diasSemVisita: number | null;
  rebaixadoPorVenda: boolean;
  /** Só a ficha do cliente tem este número; na lista, cai no texto genérico. */
  diasSemCompra?: number | null;
};

/** "hoje" para 0, "ontem" para 1, "{n} dias" para os demais. */
export function formatarDias(n: number): string {
  if (n === 0) {
    return 'hoje';
  }
  if (n === 1) {
    return 'ontem';
  }
  return `${n} dias`;
}

/** Como `formatarDias`, mas no passado: "hoje", "ontem" ou "há {n} dias". */
function haQuantoTempo(n: number): string {
  return n > 1 ? `há ${n} dias` : formatarDias(n);
}

export function descreverSituacao({ cor, diasSemVisita, rebaixadoPorVenda, diasSemCompra }: Situacao): string {
  switch (cor) {
    case 'VERMELHO':
      return diasSemVisita === null ? 'Nunca visitado' : `Atrasado · ${formatarDias(diasSemVisita)} sem visita`;
    case 'LARANJA':
      if (rebaixadoPorVenda) {
        return diasSemCompra == null
          ? `Rebaixado: sem compra há mais de ${LIMIAR_SEM_COMPRA_DIAS} dias`
          : `Sem compra há ${diasSemCompra} dias`;
      }
      return `Vencendo · ${formatarDias(diasSemVisita ?? 0)} sem visita`;
    case 'AMARELO':
      return `Visitado sem venda · ${haQuantoTempo(diasSemVisita ?? 0)}`;
    case 'VERDE':
      return `Em dia · visita ${haQuantoTempo(diasSemVisita ?? 0)}, com venda`;
  }
}
