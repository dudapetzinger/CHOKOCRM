/**
 * Legenda das situações (Etapa 7, spec 5.1): botão "?" ao lado das abas que
 * abre um balão com a régua da classificação, uma frase por situação. Os
 * números vêm de config/classificacao.ts.
 */
import {
  LIMIAR_LARANJA_DIAS,
  LIMIAR_SEM_COMPRA_DIAS,
  LIMIAR_VERDE_AMARELO_DIAS,
} from '../config/classificacao';

const FRASES: readonly string[] = [
  `Em dia: visitado há até ${LIMIAR_VERDE_AMARELO_DIAS} dias, com venda.`,
  `Atenção: visitado há até ${LIMIAR_VERDE_AMARELO_DIAS} dias, sem venda.`,
  `Vencendo: ${LIMIAR_VERDE_AMARELO_DIAS + 1} a ${LIMIAR_LARANJA_DIAS} dias sem visita.`,
  `Atrasado: mais de ${LIMIAR_LARANJA_DIAS} dias ou nunca visitado.`,
  `Cliente sem compra no ERP há mais de ${LIMIAR_SEM_COMPRA_DIAS} dias cai para Vencendo.`,
];

export function LegendaSituacao() {
  return (
    <details className="legenda-situacao">
      <summary aria-label="O que significam as situações">?</summary>
      <ul className="legenda-situacao-texto">
        {FRASES.map((frase) => (
          <li key={frase}>{frase}</li>
        ))}
      </ul>
    </details>
  );
}
