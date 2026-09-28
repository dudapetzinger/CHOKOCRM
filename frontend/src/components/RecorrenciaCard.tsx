/**
 * Card de recorrência de visitas na ficha do cliente (UC05/UC09, Etapa 4).
 *
 * Separado do formulário genérico de edição do cliente porque alterar a
 * recorrência exige justificativa e fica registrado no histórico (só a
 * representante pode alterar — gestor nem vê o card, ver `podeAlterar` e a
 * regra de exibição em `ClienteDetalhePage`).
 */
import { useState, type FormEvent } from 'react';
import { useAlterarRecorrencia } from '../hooks/useRecorrencia';
import { FAIXA_RECORRENCIA_SUGERIDA, mensagemErroApi, type RecorrenciaChange } from '../services/clients';
import { formatarData } from '../lib/formatarData';

const MENSAGEM_ERRO_ALTERAR = 'Não foi possível alterar a recorrência.';

type Props = {
  clienteId: string;
  recorrenciaDias: number;
  historico: RecorrenciaChange[];
  podeAlterar: boolean;
};

export function RecorrenciaCard({ clienteId, recorrenciaDias, historico, podeAlterar }: Props) {
  const [editando, setEditando] = useState(false);
  const [valorDias, setValorDias] = useState('');
  const [justificativa, setJustificativa] = useState('');
  const [erroValidacao, setErroValidacao] = useState<string | null>(null);
  const [erroJustificativa, setErroJustificativa] = useState<string | null>(null);

  const mutationAlterar = useAlterarRecorrencia(clienteId);

  function entrarModoEdicao(): void {
    setValorDias(String(recorrenciaDias));
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

  const numeroDias = Number(valorDias);
  const foraDaFaixa =
    valorDias.trim() !== '' &&
    Number.isInteger(numeroDias) &&
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
    <section className="card" aria-labelledby="titulo-recorrencia">
      <h2 id="titulo-recorrencia" className="card-titulo">
        Recorrência de visitas
      </h2>

      {!editando && (
        <>
          <p className="cliente-info">A cada {recorrenciaDias} dias</p>
          {podeAlterar && (
            <div className="acoes-linha">
              <button type="button" className="btn-secundario" onClick={entrarModoEdicao}>
                Alterar
              </button>
            </div>
          )}
        </>
      )}

      {editando && (
        <form onSubmit={handleSubmit} noValidate>
          {mutationAlterar.isError && (
            <p className="aviso aviso-atencao" role="alert">
              {mensagemErroApi(mutationAlterar.error, MENSAGEM_ERRO_ALTERAR)}
            </p>
          )}

          <div className="campo">
            <label htmlFor="recorrencia-dias">Recorrência de visitas em dias</label>
            <input
              type="number"
              id="recorrencia-dias"
              min={1}
              max={365}
              value={valorDias}
              onChange={(event) => setValorDias(event.target.value)}
            />
            {erroValidacao && (
              <p className="erro-campo" role="alert">
                {erroValidacao}
              </p>
            )}
          </div>

          {foraDaFaixa && (
            <p className="aviso aviso-atencao">Valor fora da faixa sugerida de 15 a 30 dias.</p>
          )}

          <div className="campo">
            <label htmlFor="recorrencia-justificativa">Justificativa</label>
            <textarea
              id="recorrencia-justificativa"
              value={justificativa}
              onChange={(event) => setJustificativa(event.target.value)}
            />
            {erroJustificativa && (
              <p className="erro-campo" role="alert">
                {erroJustificativa}
              </p>
            )}
          </div>

          <div className="acoes-linha">
            <button
              type="button"
              className="btn-secundario"
              onClick={cancelar}
              disabled={mutationAlterar.isPending}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primario" disabled={mutationAlterar.isPending}>
              {mutationAlterar.isPending
                ? 'Salvando...'
                : foraDaFaixa
                  ? 'Confirmar mesmo assim'
                  : 'Salvar recorrência'}
            </button>
          </div>
        </form>
      )}

      <h3 className="card-titulo">Histórico de alterações</h3>
      {historico.length === 0 ? (
        <p className="campo-ajuda">Nenhuma alteração registrada.</p>
      ) : (
        historico.map((mudanca) => (
          <p className="cliente-info" key={mudanca.id}>
            {mudanca.autor.nome}, {formatarData(mudanca.data)}: de {mudanca.de} para {mudanca.para} dias —{' '}
            {mudanca.justificativa}
          </p>
        ))
      )}
    </section>
  );
}
