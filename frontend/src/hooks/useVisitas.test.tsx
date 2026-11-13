import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useEditarVisita } from './useVisitas';

vi.mock('../services/visits', () => ({
  editarVisita: vi.fn().mockResolvedValue({ id: 'v1' }),
  listarVisitas: vi.fn(),
  buscarFoto: vi.fn(),
  enviarFoto: vi.fn(),
}));

describe('useEditarVisita', () => {
  it('invalida a visita, a ficha, a lista de clientes, a agenda, as campanhas, as metas e o painel ao salvar', async () => {
    const queryClient = new QueryClient();
    const invalidar = vi.spyOn(queryClient, 'invalidateQueries');
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => useEditarVisita('c1'), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ visitaId: 'v1', dados: { resultado: 'VENDA' } });
    });

    await waitFor(() => expect(invalidar).toHaveBeenCalled());
    const chaves = invalidar.mock.calls.map(([filtro]) => filtro?.queryKey);
    expect(chaves).toEqual(
      expect.arrayContaining([
        ['client', 'c1', 'visits'],
        ['client', 'c1'],
        ['clients'],
        ['agenda'],
        ['campanhas'],
        ['metas'],
        ['dashboard'],
      ]),
    );
  });
});
