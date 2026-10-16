import { act, renderHook } from '@testing-library/react';
import { registrarFalhaDeRede, registrarRespostaDaApi } from './estadoRede';
import { useOnline } from './useOnline';

function simularNavegadorOnline(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online);
}

afterEach(() => {
  vi.restoreAllMocks();
  registrarRespostaDaApi();
});

describe('useOnline', () => {
  it('começa com o navigator.onLine', () => {
    simularNavegadorOnline(true);
    const { result } = renderHook(() => useOnline());

    expect(result.current).toBe(true);
  });

  it('evento offline → false; evento online → true de novo', () => {
    simularNavegadorOnline(true);
    const { result } = renderHook(() => useOnline());

    act(() => {
      simularNavegadorOnline(false);
      window.dispatchEvent(new Event('offline'));
    });
    expect(result.current).toBe(false);

    act(() => {
      simularNavegadorOnline(true);
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });

  it('uma chamada à API que falhou por rede → false até a próxima resposta da API', () => {
    simularNavegadorOnline(true);
    const { result } = renderHook(() => useOnline());

    act(() => registrarFalhaDeRede());
    expect(result.current).toBe(false);

    act(() => registrarRespostaDaApi());
    expect(result.current).toBe(true);
  });

  it('o evento online também limpa a falha de rede registrada pela API', () => {
    simularNavegadorOnline(true);
    const { result } = renderHook(() => useOnline());

    act(() => registrarFalhaDeRede());
    act(() => {
      window.dispatchEvent(new Event('online'));
    });
    expect(result.current).toBe(true);
  });
});
