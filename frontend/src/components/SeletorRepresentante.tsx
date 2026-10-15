/**
 * Seletor de representante do gestor (Etapa 7): pílulas "Todos · Eduarda ·
 * Rafael …" logo abaixo do cabeçalho de Clientes, Agenda e Painel. A escolha
 * fica no `RepresentanteContext`, então vale nas três telas. Para o
 * representante não aparece. Enquanto a lista carrega, só "Todos".
 */
import { useAuth } from '../auth/useAuth';
import { useRepresentantes } from '../hooks/useRepresentantes';
import { useRepresentante } from '../representante/useRepresentante';
import { FiltroPilulas, type Opcao } from './FiltroPilulas';

function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0];
}

export function SeletorRepresentante() {
  const { user } = useAuth();
  const { representanteId, setRepresentanteId } = useRepresentante();
  const { data: representantes = [] } = useRepresentantes();

  if (user?.role !== 'GESTOR') {
    return null;
  }

  const opcoes: Opcao<string>[] = [
    { valor: '', rotulo: 'Todos' },
    ...representantes.map((representante) => ({ valor: representante.id, rotulo: primeiroNome(representante.nome) })),
  ];

  return (
    <FiltroPilulas
      rotulo="Representante"
      ariaLabel="Filtrar por representante"
      opcoes={opcoes}
      valor={representanteId ?? ''}
      onChange={(valor) => setRepresentanteId(valor === '' ? null : valor)}
    />
  );
}
