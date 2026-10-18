import { act, renderHook } from '@testing-library/react';
import { removerSimulacaoDeLargura, simularLargura } from '../test/simularLargura';
import {
  LARGURA_DESKTOP_MIN,
  LARGURA_DUAS_COLUNAS_MIN,
  useLarguraDesktop,
  useLarguraDuasColunas,
} from './useLarguraDesktop';

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

describe('useLarguraDuasColunas', () => {
  it('consulta a largura mínima de 1024 px', () => {
    const { matchMedia } = simularLargura(true);
    renderHook(() => useLarguraDuasColunas());

    expect(LARGURA_DUAS_COLUNAS_MIN).toBe(1024);
    expect(matchMedia).toHaveBeenCalledWith('(min-width: 1024px)');
  });

  it('num tablet (900 px), a moldura é a de desktop, mas Clientes não tem duas colunas', () => {
    simularLargura(900);

    expect(renderHook(() => useLarguraDesktop()).result.current).toBe(true);
    expect(renderHook(() => useLarguraDuasColunas()).result.current).toBe(false);
  });

  it('acompanha o evento change ao redimensionar', () => {
    const largura = simularLargura(900);
    const { result } = renderHook(() => useLarguraDuasColunas());
    expect(result.current).toBe(false);

    act(() => largura.mudar(1024));
    expect(result.current).toBe(true);

    act(() => largura.mudar(1023));
    expect(result.current).toBe(false);
  });

  it('é false quando o navegador não tem matchMedia', () => {
    removerSimulacaoDeLargura();
    const { result } = renderHook(() => useLarguraDuasColunas());

    expect(result.current).toBe(false);
  });
});
