import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { agora, definirDeslocamento } from '../lib/relogio';
import { buscarRelogio } from '../services/sistema';
import { useRelogio } from './useRelogio';

vi.mock('../services/sistema', () => ({ buscarRelogio: vi.fn() }));

afterEach(() => {
  vi.useRealTimers();
  definirDeslocamento(0);
});

function envolver({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

describe('useRelogio', () => {
  it('busca o relógio público mesmo sem ninguém logado (tela de login) e aplica o deslocamento', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-09T15:00:00.000Z'));
    vi.mocked(buscarRelogio).mockResolvedValue({
      agora: '2027-03-15T15:00:00.000Z',
      simulado: true,
      dataDeDemonstracao: '2027-03-15',
      diaDeReferencia: '2026-11-09',
      deslocamentoDias: 126,
    });

    const { result } = renderHook(() => useRelogio(), { wrapper: envolver });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.dataDeDemonstracao).toBe('2027-03-15');
    expect(agora().toISOString().slice(0, 10)).toBe('2027-03-15');
  });

  it('se a busca falha, volta ao relógio real', async () => {
    definirDeslocamento(86_400_000);
    vi.mocked(buscarRelogio).mockRejectedValue(new Error('falhou'));

    const { result } = renderHook(() => useRelogio(), { wrapper: envolver });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const diferenca = Math.abs(agora().getTime() - Date.now());
    expect(diferenca).toBeLessThan(1000);
  });
});
