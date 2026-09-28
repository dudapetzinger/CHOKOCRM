/**
 * Card "Mensagem de estoque" na ficha do cliente (UC12, Etapa 6A): o
 * representante gera uma mensagem de consulta de estoque com texto proposto
 * pelo sistema (evento sazonal vigente, se houver), revisa e abre no
 * WhatsApp via link `wa.me`; o histórico de mensagens geradas fica visível
 * para todos os papéis (só a geração é exclusiva do representante com
 * cliente ativo, ver `podeGerar` em `ClienteDetalhePage`).
 */
import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useMensagensEstoque, useGerarMensagemEstoque } from '../hooks/useMensagensEstoque';
import { buscarProposta } from '../services/stockMessages';
import { mensagemErroApi } from '../services/clients';
import { formatarDataHora } from '../lib/formatarData';

const MENSAGEM_ERRO_GERAR = 'Não foi possível gerar a mensagem.';
const CONTATO_TELEFONE_CLIENTE = '';

type Props = {
  clienteId: string;
  podeGerar: boolean;
};

export function MensagemEstoqueCard({ clienteId, podeGerar }: Props) {
  const [contactId, setContactId] = useState(CONTATO_TELEFONE_CLIENTE);
  const [texto, setTexto] = useState('');
  const [erroTexto, setErroTexto] = useState<string | null>(null);

  const { data: mensagens } = useMensagensEstoque(clienteId);
  const mutationGerar = useGerarMensagemEstoque(clienteId);

  const mutationProposta = useMutation({
    mutationFn: () => buscarProposta(clienteId),
    onSuccess: (proposta) => {
      const principal = proposta.contatos.find((contato) => contato.principal);
      setContactId(principal?.id ?? CONTATO_TELEFONE_CLIENTE);
      setTexto(proposta.textoSugerido);
      setErroTexto(null);
    },
  });

  function iniciarGeracao(): void {
    mutationGerar.reset();
    mutationProposta.mutate();
  }

  function cancelar(): void {
    mutationProposta.reset();
    mutationGerar.reset();
    setErroTexto(null);
    setContactId(CONTATO_TELEFONE_CLIENTE);
    setTexto('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const textoTratado = texto.trim();
    if (textoTratado.length < 10) {
      setErroTexto('A mensagem deve ter pelo menos 10 caracteres.');
      return;
    }
    setErroTexto(null);

    mutationGerar.mutate(
      { texto: textoTratado, contactId: contactId || undefined },
      {
        onSuccess: (geracao) => {
          window.open(geracao.link, '_blank', 'noopener');
        },
      },
    );
  }

  const proposta = mutationProposta.data;
  const geracao = mutationGerar.data;

  return (
    <section className="card" aria-labelledby="titulo-mensagem-estoque">
      <h2 id="titulo-mensagem-estoque" className="card-titulo">
        Mensagem de estoque
      </h2>

      {podeGerar && mutationGerar.isSuccess && geracao && (
        <>
          <p className="aviso">Mensagem registrada em {formatarDataHora(geracao.dataGeracao)}.</p>
          <div className="acoes-linha">
            <a className="btn-primario" href={geracao.link} target="_blank" rel="noopener">
              Abrir no WhatsApp
            </a>
          </div>
        </>
      )}

      {podeGerar && !mutationGerar.isSuccess && proposta && (
        <form onSubmit={handleSubmit} noValidate>
          {mutationGerar.isError && (
            <p className="aviso aviso-atencao" role="alert">
              {mensagemErroApi(mutationGerar.error, MENSAGEM_ERRO_GERAR)}
            </p>
          )}

          <label className="campo">
            <span className="etiqueta">Enviar para</span>
            <select value={contactId} onChange={(event) => setContactId(event.target.value)}>
              {proposta.contatos.map((contato) => (
                <option key={contato.id} value={contato.id}>
                  {contato.nome} — {contato.telefone}
                </option>
              ))}
              <option value={CONTATO_TELEFONE_CLIENTE}>
                Telefone do cliente ({proposta.telefoneCliente})
              </option>
            </select>
          </label>

          {proposta.evento ? (
            <p className="campo-ajuda">
              Evento vigente: {proposta.evento.nome} — produtos sugeridos:{' '}
              {proposta.evento.produtosSugeridos.join(', ')}.
            </p>
          ) : (
            <p className="campo-ajuda">Sem evento sazonal vigente — mensagem genérica.</p>
          )}

          <div className="campo">
            <label htmlFor="mensagem-estoque-texto">Mensagem</label>
            <textarea
              id="mensagem-estoque-texto"
              value={texto}
              onChange={(event) => setTexto(event.target.value)}
              rows={5}
            />
            {erroTexto && (
              <p className="erro-campo" role="alert">
                {erroTexto}
              </p>
            )}
          </div>

          <div className="acoes-linha">
            <button
              type="button"
              className="btn-secundario"
              onClick={cancelar}
              disabled={mutationGerar.isPending}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primario" disabled={mutationGerar.isPending}>
              {mutationGerar.isPending ? 'Gerando...' : 'Confirmar e abrir no WhatsApp'}
            </button>
          </div>
        </form>
      )}

      {podeGerar && !mutationGerar.isSuccess && !proposta && (
        <>
          {mutationProposta.isError && (
            <p className="aviso aviso-atencao" role="alert">
              {mensagemErroApi(mutationProposta.error, MENSAGEM_ERRO_GERAR)}
            </p>
          )}
          <div className="acoes-linha">
            <button
              type="button"
              className="btn-primario"
              onClick={iniciarGeracao}
              disabled={mutationProposta.isPending}
            >
              {mutationProposta.isPending ? 'Carregando...' : 'Gerar mensagem'}
            </button>
          </div>
        </>
      )}

      <h3 className="card-titulo">Mensagens geradas</h3>
      {!mensagens || mensagens.length === 0 ? (
        <p className="campo-ajuda">Nenhuma mensagem gerada para este cliente.</p>
      ) : (
        mensagens.map((mensagem) => (
          <details key={mensagem.id}>
            <summary>
              {formatarDataHora(mensagem.dataGeracao)} · {mensagem.autor.nome} ·{' '}
              {mensagem.evento?.nome ?? 'sem evento'}
            </summary>
            <p className="cliente-info">{mensagem.textoFinal}</p>
          </details>
        ))
      )}
    </section>
  );
}
