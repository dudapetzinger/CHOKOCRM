/**
 * Falha de rede vista pela própria API (ADR-012). O `navigator.onLine` só
 * diz se o aparelho tem alguma conexão: com Wi-Fi sem internet, ou dados
 * móveis que não respondem, ele continua `true` e o `fetch` falha. Por isso
 * `services/api.ts` registra aqui cada falha de rede e cada resposta que
 * chegou, e `useOnline` junta as duas fontes para o `AvisoSemRede`.
 *
 * Módulo sem React (é importado por `api.ts`); quem precisa reagir assina.
 */
type Ouvinte = () => void;

let falhou = false;
const ouvintes = new Set<Ouvinte>();

function mudar(valor: boolean): void {
  if (falhou === valor) return;
  falhou = valor;
  ouvintes.forEach((ouvinte) => ouvinte());
}

/** A última chamada à API não chegou ao servidor (`fetch` rejeitou). */
export function registrarFalhaDeRede(): void {
  mudar(true);
}

/** Uma resposta da API chegou (qualquer status): a rede voltou. */
export function registrarRespostaDaApi(): void {
  mudar(false);
}

export function semRedeNaApi(): boolean {
  return falhou;
}

export function assinarEstadoRede(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}
