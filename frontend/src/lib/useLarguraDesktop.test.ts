import { act, renderHook } from '@testing-library/react';
import { removerSimulacaoDeLargura, simularLargura } from '../test/simularLargura';
import { LARGURA_DESKTOP_MIN, useLarguraDesktop } from './useLarguraDesktop';

afterEach(() => {
  removerSimulacaoDeLargura();
});

describe('useLarguraDesktop', () => {
  it('consulta a largura mínima de 768 px', () => {
    const { matchMedia } = simularLargura(true);
    renderHook(() => useLarguraDesktop());

    expect(LARGURA_DESKTOP_MIN).toBe(768);
    expect(matchMedia).toHaveBeenCalledWith('(min-width: 768px)');
  });

  it('é true quando a consulta corresponde', () => {
    simularLargura(true);
    const { result } = renderHook(() => useLarguraDesktop());

    expect(result.current).toBe(true);
  });

  it('é false quando a consulta não corresponde', () => {
    simularLargura(false);
    const { result } = renderHook(() => useLarguraDesktop());

    expect(result.current).toBe(false);
  });

  it('é false quando o navegador não tem matchMedia', () => {
    removerSimulacaoDeLargura();
    const { result } = renderHook(() => useLarguraDesktop());

    expect(result.current).toBe(false);
  });

  it('acompanha o evento change ao redimensionar', () => {
    const largura = simularLargura(false);
    const { result } = renderHook(() => useLarguraDesktop());

    act(() => largura.mudar(true));
    expect(result.current).toBe(true);

    act(() => largura.mudar(false));
    expect(result.current).toBe(false);
  });
});
