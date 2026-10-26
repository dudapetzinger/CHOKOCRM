/**
 * Relógio fixo para os testes de integração que dependem de "hoje": só o
 * `Date` é falso; os timers (setTimeout, setImmediate, nextTick…) ficam
 * reais, porque o pg, o supertest e o Prisma dependem deles. Sem isto, um
 * teste que grava visitas "há N dias" a partir de `new Date()` e lê "hoje"
 * em São Paulo oscila perto da meia-noite (entre 21h e 0h em São Paulo a
 * data UTC já é a de amanhã).
 */
export function fixarRelogio(agora: Date): void {
  jest.useFakeTimers({
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
    now: agora,
  });
}

export function liberarRelogio(): void {
  jest.useRealTimers();
}
