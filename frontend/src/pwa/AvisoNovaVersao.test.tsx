import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RegisterSWOptions } from 'vite-plugin-pwa/types';
import { AvisoNovaVersao } from './AvisoNovaVersao';

const registro = vi.hoisted(() => ({
  opcoes: undefined as RegisterSWOptions | undefined,
  precisaAtualizar: false,
  updateServiceWorker: vi.fn(async () => {}),
}));

vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: (opcoes?: RegisterSWOptions) => {
    registro.opcoes = opcoes;
    return {
      needRefresh: [registro.precisaAtualizar, () => {}],
      offlineReady: [false, () => {}],
      updateServiceWorker: registro.updateServiceWorker,
    };
  },
}));

beforeEach(() => {
  registro.opcoes = undefined;
  registro.precisaAtualizar = false;
  registro.updateServiceWorker.mockClear();
});

describe('AvisoNovaVersao', () => {
  it('sem versão nova → nada na tela', () => {
    render(<AvisoNovaVersao />);

    expect(screen.queryByText('Nova versão disponível')).not.toBeInTheDocument();
  });

  it('service worker novo assumiu (autoUpdate) → aviso em vez de recarregar a página sozinho', () => {
    render(<AvisoNovaVersao />);
    expect(registro.opcoes?.onNeedReload).toBeTypeOf('function');

    act(() => registro.opcoes?.onNeedReload?.());

    expect(screen.getByText('Nova versão disponível')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Atualizar' })).toBeInTheDocument();
  });

  it('needRefresh (modo prompt) → "Atualizar" ativa o service worker novo', async () => {
    registro.precisaAtualizar = true;
    const usuario = userEvent.setup();
    render(<AvisoNovaVersao />);

    await usuario.click(screen.getByRole('button', { name: 'Atualizar' }));

    expect(registro.updateServiceWorker).toHaveBeenCalledWith(true);
  });
});
