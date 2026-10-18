/**
 * Foco nos formulários (Etapa 8): para o teclado e o leitor de tela não se
 * perderem quando um formulário em linha abre e fecha ou quando a validação
 * falha.
 */
import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Devolve o foco a quem abriu um formulário em linha (ex.: `NovoContato`)
 * quando ele fecha por `aoConcluir`. O gatilho pode ter saído da tela
 * enquanto o formulário estava aberto (o botão "Adicionar contato" some):
 * o foco vai para ele depois que `aberto` passa a `false` e ele volta a ser
 * desenhado. Fechar por outro motivo (ex.: abrir outro formulário no lugar)
 * não mexe no foco: só `devolverFoco()` marca a volta.
 */
export function useDevolverFoco<T extends HTMLElement>(aberto: boolean) {
  const ref = useRef<T | null>(null);
  const pendente = useRef(false);

  useEffect(() => {
    if (aberto || !pendente.current) return;
    pendente.current = false;
    ref.current?.focus();
  }, [aberto]);

  const devolverFoco = useCallback(() => {
    pendente.current = true;
  }, []);

  return { ref, devolverFoco };
}

/**
 * Depois de uma validação que falhou, leva o foco ao primeiro controle com
 * `aria-invalid="true"` dentro de `ref`: o leitor de tela lê o rótulo e a
 * mensagem de erro, ligada por `aria-describedby` (ver `Campo`). Chamar
 * `focarPrimeiroErro()` junto com o `setState` dos erros; o foco vai depois
 * do render, quando os atributos já estão no DOM (o contador garante o
 * render mesmo quando os erros são os mesmos da tentativa anterior).
 */
export function useFocoNoPrimeiroErro<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [pedidos, setPedidos] = useState(0);

  useEffect(() => {
    if (pedidos === 0) return;
    ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [pedidos]);

  const focarPrimeiroErro = useCallback(() => setPedidos((anterior) => anterior + 1), []);

  return { ref, focarPrimeiroErro };
}
