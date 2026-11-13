/**
 * Seletor de representante do gestor (um `<select>`): "Todos
 * os representantes" e o nome completo de cada um, logo abaixo do cabeçalho
 * de Clientes, Agenda e Painel. O select não quebra linha no celular
 * e comporta muitos representantes. A escolha fica no
 * `RepresentanteContext`, então vale nas três telas. Para o representante
 * não aparece. Enquanto a lista carrega, só "Todos os representantes".
 * Visual do `selectCls` do protótipo, com 44 px no celular. Por
 * padrão ocupa a linha toda no celular, a largura do texto a partir de
 * 768 px e deixa 16 px de respiro embaixo (Agenda e Painel, onde ele fica
 * solto acima do conteúdo); `className` troca essa regra de layout (Clientes,
 * na barra de ferramentas, decide a largura pela largura da barra).
 */
import { cn } from '@/lib/utils';
import { useAuth } from '../auth/useAuth';
import { useRepresentantes } from '../hooks/useRepresentantes';
import { useRepresentante } from '../representante/useRepresentante';
import { CLASSES_SELECT } from './crm/ui';

export function SeletorRepresentante({ className = 'mb-4 w-full md:w-auto' }: { className?: string }) {
  const { user } = useAuth();
  const { representanteId, setRepresentanteId } = useRepresentante();
  const { data: representantes = [] } = useRepresentantes();

  if (user?.role !== 'GESTOR') {
    return null;
  }

  return (
    <>
      <label className="sr-only" htmlFor="seletor-representante">
        Representante
      </label>
      <select
        id="seletor-representante"
        className={cn(CLASSES_SELECT, 'max-w-full', className)}
        aria-label="Filtrar por representante"
        value={representanteId ?? ''}
        onChange={(event) => setRepresentanteId(event.target.value === '' ? null : event.target.value)}
      >
        <option value="">Todos os representantes</option>
        {representantes.map((representante) => (
          <option key={representante.id} value={representante.id}>
            {representante.nome}
          </option>
        ))}
      </select>
    </>
  );
}
