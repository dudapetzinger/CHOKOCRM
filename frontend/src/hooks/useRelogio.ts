/**
 * Relógio de demonstração: carrega `GET /sistema/relogio` (rota pública: a
 * `Moldura` das telas logadas e o `ModoDemonstracao` da tela de login usam o
 * mesmo cache `['sistema', 'relogio']`) e aplica o deslocamento em
 * `lib/relogio.ts` dentro da própria `queryFn`, antes de qualquer tela que
 * dependa de `agora()` renderizar.
 *
 * `staleTime` de 5 min com `refetchOnWindowFocus`: um PWA que volta do
 * segundo plano depois de uma troca de data busca o relógio novo sem
 * precisar de build novo. A `Moldura` só segura a tela na primeira carga
 * (`isPending`), nunca nas buscas seguintes.
 *
 * `retry: 1`: se falhar de novo, as telas seguem com o relógio real e sem
 * faixa. Uma busca que falha depois de uma sessão simulada zera o
 * deslocamento (`definirDeslocamento(0)`) antes de propagar o erro, para não
 * ficar uma data simulada antiga sem a faixa que avisa dela.
 */
import { useQuery } from '@tanstack/react-query';
import { definirDeslocamento, definirRelogio } from '../lib/relogio';
import { buscarRelogio } from '../services/sistema';

const CINCO_MINUTOS_MS = 5 * 60 * 1000;

export function useRelogio() {
  return useQuery({
    queryKey: ['sistema', 'relogio'],
    queryFn: async () => {
      try {
        const relogio = await buscarRelogio();
        definirRelogio(relogio);
        return relogio;
      } catch (erro) {
        definirDeslocamento(0);
        throw erro;
      }
    },
    staleTime: CINCO_MINUTOS_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}
