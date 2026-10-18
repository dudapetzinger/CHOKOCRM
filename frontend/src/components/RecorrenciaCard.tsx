/**
 * Card de recorrência de visitas na ficha do cliente (UC09, Etapa 4).
 *
 * Separado do formulário genérico de edição do cliente porque alterar a
 * recorrência exige justificativa e fica registrado no histórico (só a
 * representante pode alterar — o gestor vê o valor e o histórico, mas não
 * o botão "Alterar", ver `podeAlterar` em `ClienteDetalhePage`). Visual do
 * protótipo (Etapa 8): "Alterar" na ação do cartão.
 */
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { useAlterarRecorrencia } from '../hooks/useRecorrencia';
import { FAIXA_RECORRENCIA_SUGERIDA, mensagemErroApi, type RecorrenciaChange } from '../services/clients';
import { formatarData } from '../lib/formatarData';
import { AreaTextoCrescente } from './AreaTextoCrescente';
import { SeletorRecorrencia } from './SeletorRecorrencia';
import { EstadoVazio } from './EstadoVazio';
import { Aviso, Cartao } from './crm/ui';

const MENSAGEM_ERRO_ALTERAR = 'Não foi possível alterar a recorrência.';

type Props = {
  clienteId: string;
  recorrenciaDias: number;
  historico: RecorrenciaChange[];
  podeAlterar: boolean;
};

export function RecorrenciaCard({ clienteId, recorrenciaDias, historico, podeAlterar }: Props) {
  const [editando, setEditando] = useState(false);
  // Número vindo do SeletorRecorrencia; o campo "Outro" vazio chega como NaN
  const [valorDias, setValorDias] = useState(Number.NaN);
  const [justificativa, setJustificativa] = useState('');
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);
  const [erroJustificativa, setErroJustificativa] = useState<string | null>(null);

  const mutationAlterar = useAlterarRecorrencia(clienteId);

  function entrarModoEdicao(): void {
    setValorDias(recorrenciaDias);
    setJustificativa('');
    setErroValidacao(null);
    setErroJustificativa(null);
    mutationAlterar.reset();
    setEditando(true);
  }

  function cancelar(): void {
    setEditando(false);
    setErroValidacao(null);
    setErroJustificativa(null);
  }

  const numeroDias = valorDias;
  const foraDaFaixa =
    Number.isInteger(numeroDias) &&
    numeroDias >= 1 &&
    numeroDias <= 365 &&
    (numeroDias < FAIXA_RECORRENCIA_SUGERIDA.min || numeroDias > FAIXA_RECORRENCIA_SUGERIDA.max);

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    let valido = true;
    if (!Number.isInteger(numeroDias) || numeroDias < 1 || numeroDias > 365) {
      setErroValidacao('Recorrência de visitas deve ser um número inteiro entre 1 e 365.');
      valido = false;
    } else {
      setErroValidacao(null);
    }

    if (!justificativa.trim()) {
      setErroJustificativa('Informe a justificativa da alteração.');
      valido = false;
    } else {
      setErroJustificativa(null);
    }

    if (!valido) return;

    mutationAlterar.mutate(
      { recorrenciaDias: numeroDias, justificativa: justificativa.trim() },
      { onSuccess: () => setEditando(false) },
    );
  }

  return (
    <Cartao
      titulo="Recorrência de visitas"
      acao={
        podeAlterar &&
        !editando && (
          <Button size="sm" variant="outline" onClick={entrarModoEdicao}>
            Alterar
          </Button>
        )
      }
    >
      {!editando && <p className="text-sm">A cada {recorrenciaDias} dias</p>}

      {editando && (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {mutationAlterar.isError && (
            <Aviso tom="erro" role="alert">
              {mensagemErroApi(mutationAlterar.error, MENSAGEM_ERRO_ALTERAR)}
            </Aviso>
          )}

          <div className="space-y-1.5">
            <label htmlFor="recorrencia-dias" className="block text-sm font-medium">
              Recorrência de visitas em dias
            </label>
            <SeletorRecorrencia id="recorrencia-dias" valor={valorDias} onChange={setValorDias} />
            {erroValidacao && (
              <p className="text-sm font-medium text-destructive" role="alert">
                {erroValidacao}
              </p>
            )}
          </div>

          {foraDaFaixa && <Aviso tom="atencao">Valor fora da faixa sugerida de 15 a 30 dias.</Aviso>}

          <div className="space-y-1.5">
            <label htmlFor="recorrencia-justificativa" className="block text-sm font-medium">
              Justificativa
            </label>
            <AreaTextoCrescente
              id="recorrencia-justificativa"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:text-sm"
              value={justificativa}
              onChange={(event) => setJustificativa(event.target.value)}
              placeholder="Ex.: Cliente pediu visitas mais espaçadas na baixa temporada."
              aria-invalid={erroJustificativa ? true : undefined}
            />
            {erroJustificativa && (
              <p className="text-sm font-medium text-destructive" role="alert">
                {erroJustificativa}
              </p>
            )}
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button type="button" variant="outline" onClick={cancelar} disabled={mutationAlterar.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutationAlterar.isPending}>
              {mutationAlterar.isPending
                ? 'Salvando...'
                : foraDaFaixa
                  ? 'Confirmar mesmo assim'
                  : 'Salvar recorrência'}
            </Button>
          </div>
        </form>
      )}

      <h3 className="mt-5 mb-2 text-xs font-semibold text-muted-foreground uppercase">Histórico de alterações</h3>
      {historico.length === 0 ? (
        <EstadoVazio icone="repeat">Nenhuma alteração registrada.</EstadoVazio>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {historico.map((mudanca) => (
            <li key={mudanca.id}>
              {mudanca.autor.nome}, {formatarData(mudanca.data)}: de {mudanca.de} para {mudanca.para} dias —{' '}
              {mudanca.justificativa}
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}
