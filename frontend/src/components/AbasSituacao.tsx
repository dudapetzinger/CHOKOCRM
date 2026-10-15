/**
 * Abas da lista de clientes por ação (Etapa 7, spec 5.1): Prioridade
 * (LARANJA e VERMELHO), Atenção (AMARELO), Em dia (VERDE) e Todos, cada uma
 * com a contagem ("Prioridade · 7"). Controlado: quem usa guarda a aba e
 * calcula as contagens.
 */
import type { Cor } from '../services/clients';

export type Aba = 'PRIORIDADE' | 'ATENCAO' | 'EM_DIA' | 'TODOS';

const ABAS: readonly Aba[] = ['PRIORIDADE', 'ATENCAO', 'EM_DIA', 'TODOS'];

export const ROTULO_ABA: Record<Aba, string> = {
  PRIORIDADE: 'Prioridade',
  ATENCAO: 'Atenção',
  EM_DIA: 'Em dia',
  TODOS: 'Todos',
};

export const CORES_DA_ABA: Record<Aba, readonly Cor[]> = {
  PRIORIDADE: ['LARANJA', 'VERMELHO'],
  ATENCAO: ['AMARELO'],
  EM_DIA: ['VERDE'],
  TODOS: ['VERDE', 'AMARELO', 'LARANJA', 'VERMELHO'],
};

type Props = {
  valor: Aba;
  onChange: (aba: Aba) => void;
  contagens: Record<Aba, number>;
};

export function AbasSituacao({ valor, onChange, contagens }: Props) {
  return (
    <div className="abas-situacao" role="group" aria-label="Filtrar por situação">
      {ABAS.map((aba) => (
        <button
          key={aba}
          type="button"
          className={valor === aba ? 'badge-pilula ativo' : 'badge-pilula'}
          aria-pressed={valor === aba}
          onClick={() => onChange(aba)}
        >
          {`${ROTULO_ABA[aba]} · ${contagens[aba]}`}
        </button>
      ))}
    </div>
  );
}
