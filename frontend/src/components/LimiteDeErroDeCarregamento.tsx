import { Component, type ReactNode } from 'react';
import { Aviso } from './crm/ui';
import { Button } from './ui/button';

type Props = {
  children: ReactNode;
  /** Injetável nos testes; no app, recarrega a página. */
  recarregar?: () => void;
};

type Estado = { falhou: boolean };

function recarregarPagina(): void {
  window.location.reload();
}

/**
 * Limite de erro em volta de um pedaço carregado sob demanda (o Painel, ver
 * App.tsx). Depois de um deploy, uma aba aberta antes dele pode pedir um
 * arquivo que já não existe; o `lazy` rejeita e, sem este limite, o React
 * desmontaria a tela inteira. Aqui fica um aviso com o botão de recarregar,
 * que baixa a versão nova. (O `vite:preloadError` em main.tsx já recarrega
 * sozinho uma vez por sessão; este aviso cobre o que sobrar.) Visual da
 * base nova (Etapa 8): aviso em caixa, dentro da moldura.
 */
export class LimiteDeErroDeCarregamento extends Component<Props, Estado> {
  state: Estado = { falhou: false };

  static getDerivedStateFromError(): Estado {
    return { falhou: true };
  }

  render() {
    if (!this.state.falhou) {
      return this.props.children;
    }
    return (
      <Aviso tom="atencao" role="alert" className="flex flex-wrap items-center justify-between gap-3">
        <span>O app foi atualizado.</span>
        <Button type="button" variant="outline" size="sm" onClick={this.props.recarregar ?? recarregarPagina}>
          Recarregar
        </Button>
      </Aviso>
    );
  }
}

export default LimiteDeErroDeCarregamento;
