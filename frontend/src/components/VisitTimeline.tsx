/**
 * Histórico de interações do cliente (UC08). Mostra as visitas da mais
 * recente para a mais antiga; o autor pode corrigir a descrição no lugar e
 * anexar a foto que não subiu no momento do check-in. Sem cores de
 * classificação: isso é Etapa 4.
 *
 * Componente de apresentação: não chama a API: recebe os dados e os
 * callbacks da página (ver docs/arquitetura.md).
 */
import { useState } from 'react';
import { ROTULO_RESULTADO } from '../services/visits';
import type { Visita } from '../services/visits';
import { VisitaFoto } from './VisitaFoto';

type Props = {
  visitas: Visita[];
  usuarioId: string | undefined;
  onEditarDescricao: (visitaId: string, descricao: string) => Promise<void>;
  onAnexarFoto: (visitaId: string, arquivo: File) => Promise<void>;
};

function formatarDataHora(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function VisitTimeline({ visitas, usuarioId, onEditarDescricao, onAnexarFoto }: Props) {
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (visitas.length === 0) {
    return <p className="campo-ajuda">Nenhuma visita registrada para este cliente.</p>;
  }

  async function salvarDescricao(visitaId: string) {
    if (rascunho.trim().length < 3) {
      setErro('A descrição precisa de pelo menos 3 caracteres.');
      return;
    }

    setOcupado(true);
    try {
      await onEditarDescricao(visitaId, rascunho.trim());
      setEditando(null);
      setErro(null);
    } catch {
      setErro('Não foi possível salvar a descrição.');
    } finally {
      setOcupado(false);
    }
  }

  async function anexarFoto(visitaId: string, arquivo: File) {
    setOcupado(true);
    try {
      await onAnexarFoto(visitaId, arquivo);
      setErro(null);
    } catch {
      setErro('Não foi possível enviar a foto.');
    } finally {
      setOcupado(false);
    }
  }

  return (
    <ul className="lista">
      {erro && (
        <li className="aviso aviso-atencao" role="alert">
          {erro}
        </li>
      )}

      {visitas.map((visita) => {
        const souAutor = usuarioId === visita.autor.id;

        return (
          <li key={visita.id} className="item-lista visita">
            <div className="visita-cabecalho">
              <strong>{formatarDataHora(visita.dataHora)}</strong>
              <span className="etiqueta">{ROTULO_RESULTADO[visita.resultado]}</span>
            </div>

            <p className="contato-cargo">
              {visita.contato ? `Contato: ${visita.contato.nome}` : 'Sem contato informado'} · por{' '}
              {visita.autor.nome}
            </p>

            {editando === visita.id ? (
              <div className="campo">
                <textarea
                  value={rascunho}
                  onChange={(evento) => setRascunho(evento.target.value)}
                  rows={3}
                  aria-label="Descrição da visita"
                />
                <div className="acoes-linha">
                  <button
                    type="button"
                    className="btn-primario"
                    disabled={ocupado}
                    onClick={() => void salvarDescricao(visita.id)}
                  >
                    {ocupado ? 'Salvando...' : 'Salvar'}
                  </button>
                  <button type="button" className="btn-secundario" onClick={() => setEditando(null)}>
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p>{visita.descricao}</p>
                {visita.editadoEm && (
                  <p className="campo-ajuda">Descrição editada em {formatarDataHora(visita.editadoEm)}</p>
                )}
                {souAutor && (
                  <button
                    type="button"
                    className="btn-secundario"
                    onClick={() => {
                      setEditando(visita.id);
                      setRascunho(visita.descricao);
                      setErro(null);
                    }}
                  >
                    Editar descrição
                  </button>
                )}
              </>
            )}

            {visita.temFoto ? (
              <VisitaFoto visitaId={visita.id} />
            ) : (
              souAutor && (
                <label className="campo">
                  <span className="campo-ajuda">Esta visita não tem foto de comprovação.</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    disabled={ocupado}
                    onChange={(evento) => {
                      const arquivo = evento.target.files?.[0];
                      // Limpar o valor permite escolher o MESMO arquivo de
                      // novo depois de uma falha de envio: sem isso o
                      // navegador não dispara `change` e o botão parece morto.
                      evento.target.value = '';
                      if (arquivo) void anexarFoto(visita.id, arquivo);
                    }}
                  />
                </label>
              )
            )}
          </li>
        );
      })}
    </ul>
  );
}
