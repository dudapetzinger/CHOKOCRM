import { act, render, screen } from '@testing-library/react';
import { AvisoSemRede } from './AvisoSemRede';
import { registrarFalhaDeRede, registrarRespostaDaApi } from './estadoRede';

const TEXTO = 'Você está sem internet. Os dados mostrados podem estar desatualizados.';

afterEach(() => {
  vi.restoreAllMocks();
  registrarRespostaDaApi();
});

describe('AvisoSemRede', () => {
  it('online → nada na tela', () => {
    render(<AvisoSemRede />);

    expect(screen.queryByText(TEXTO)).not.toBeInTheDocument();
  });

  it('evento offline → mostra o aviso, como status', () => {
    render(<AvisoSemRede />);

    act(() => {
      vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
      window.dispatchEvent(new Event('offline'));
    });

    const aviso = screen.getByRole('status');
    expect(aviso).toHaveTextContent(TEXTO);
    // O ícone de sem rede é decorativo: o leitor de tela lê só a frase
    expect(aviso.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('chamada à API que falhou por rede → mostra o aviso; resposta seguinte → some', () => {
    render(<AvisoSemRede />);

    act(() => registrarFalhaDeRede());
    expect(screen.getByText(TEXTO)).toBeInTheDocument();

    act(() => registrarRespostaDaApi());
    expect(screen.queryByText(TEXTO)).not.toBeInTheDocument();
  });
});
