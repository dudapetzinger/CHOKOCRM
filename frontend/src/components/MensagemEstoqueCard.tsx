/**
 * Card "Mensagem de estoque" na ficha do cliente: o
 * representante gera uma mensagem de consulta de estoque com texto proposto
 * pelo sistema (evento sazonal vigente, se houver), revisa e abre no
 * WhatsApp via link `wa.me` montado no próprio toque de "Confirmar e abrir no
 * WhatsApp" (o registro da mensagem vai ao backend em paralelo,
 * sem bloquear a abertura; com telefone que não serve para o WhatsApp o link
 * vem vazio, nada abre e o backend recusa o registro com a explicação); o histórico de mensagens geradas fica visível
 * para todos os papéis (só a geração é exclusiva do representante com
 * cliente ativo, ver `podeGerar` em `ClienteDetalhePage`). Visual do
 * protótipo: "Gerar mensagem" na ação do cartão e cada mensagem
 * gerada numa caixa cinza, recolhida (data · autor · evento) até ser aberta.
 */
import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useMensagensEstoque, useGerarMensagemEstoque } from '../hooks/useMensagensEstoque';
import { buscarProposta } from '../services/stockMessages';
import { mensagemErroApi } from '../services/clients';
import { formatarDataHora } from '../lib/formatarData';
import { linkWhatsapp } from '../lib/telefone';
import { EstadoVazio } from './EstadoVazio';
import { Aviso, Campo, Cartao, CLASSES_SELECT } from './crm/ui';

const MENSAGEM_ERRO_GERAR = 'Não foi possível gerar a mensagem.';
const MENSAGEM_ERRO_REGISTRAR = 'A mensagem abriu no WhatsApp, mas não ficou registrada.';
const CONTATO_TELEFONE_CLIENTE = '';

type Props = {
  clienteId: string;
  podeGerar: boolean;
};

export function MensagemEstoqueCard({ clienteId, podeGerar }: Props) {
  const [contactId, setContactId] = useState(CONTATO_TELEFONE_CLIENTE);
  const [texto, setTexto] = useState('');
  const [ultimoTextoSugerido, setUltimoTextoSugerido] = useState('');
  const [erroTexto, setErroTexto] = useState<string | null>(null);
  // Se a última tentativa chegou a abrir o WhatsApp (muda o aviso de erro do registro).
  const [abriuWhatsapp, setAbriuWhatsapp] = useState(false);

  const { data: mensagens, isLoading: mensagensCarregando, isError: mensagensComErro, error: erroMensagens } =
    useMensagensEstoque(clienteId);
  const mutationGerar = useGerarMensagemEstoque(clienteId);

  const mutationProposta = useMutation({
    mutationFn: () => buscarProposta(clienteId),
    onSuccess: (proposta) => {
      const principal = proposta.contatos.find((contato) => contato.principal);
      setContactId(principal?.id ?? CONTATO_TELEFONE_CLIENTE);
      setTexto(proposta.textoSugerido);
      setUltimoTextoSugerido(proposta.textoSugerido);
      setErroTexto(null);
    },
  });

  const proposta = mutationProposta.data;

  function iniciarGeracao(): void {
    mutationGerar.reset();
    mutationProposta.mutate();
  }

  function cancelar(): void {
    mutationProposta.reset();
    mutationGerar.reset();
    setErroTexto(null);
    setAbriuWhatsapp(false);
    setContactId(CONTATO_TELEFONE_CLIENTE);
    setTexto('');
    setUltimoTextoSugerido('');
  }

  /**
   * Troca "Enviar para": a saudação sugerida segue o destinatário
   * escolhido, mas só enquanto o representante não tiver editado o texto.
   * Se o texto atual ainda é exatamente a última sugestão aplicada, troca
   * pela sugestão do novo destinatário; caso contrário, o texto já editado
   * é preservado.
   */
  function handleContactChange(novoContactId: string): void {
    setContactId(novoContactId);

    const novaSugestao = proposta?.textosSugeridos.find(
      (item) => item.contactId === (novoContactId || null),
    )?.texto;

    if (novaSugestao !== undefined && texto === ultimoTextoSugerido) {
      setTexto(novaSugestao);
      setUltimoTextoSugerido(novaSugestao);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const textoTratado = texto.trim();
    if (textoTratado.length < 10) {
      setErroTexto('A mensagem deve ter pelo menos 10 caracteres.');
      return;
    }
    setErroTexto(null);

    // O WhatsApp abre no próprio toque (um popup aberto só depois da
    // resposta é bloqueado no celular); o backend segue guardando a mensagem.
    const telefone =
      proposta?.contatos.find((contato) => contato.id === contactId)?.telefone ?? proposta?.telefoneCliente ?? '';
    // Telefone que não serve (sem DDD, 0800...) dá link vazio: não abre nada, e o
    // backend recusa o registro com "Telefone inválido para gerar o link do WhatsApp."
    const link = linkWhatsapp(telefone, textoTratado);
    if (link) {
      window.open(link, '_blank', 'noopener');
    }
    setAbriuWhatsapp(link !== '');

    mutationGerar.mutate({ texto: textoTratado, contactId: contactId || undefined });
  }

  const geracao = mutationGerar.data;
  const podeIniciar = podeGerar && !mutationGerar.isSuccess && !proposta;

  return (
    <Cartao
      titulo="Mensagem de estoque"
      acao={
        podeIniciar && (
          <Button size="sm" variant="outline" onClick={iniciarGeracao} disabled={mutationProposta.isPending}>
            <MessageCircle aria-hidden="true" />
            {mutationProposta.isPending ? 'Carregando...' : 'Gerar mensagem'}
          </Button>
        )
      }
    >
      {podeGerar && mutationGerar.isSuccess && geracao && (
        <div className="mb-4 space-y-3">
          <Aviso>Mensagem registrada em {formatarDataHora(geracao.dataGeracao)}.</Aviso>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={geracao.link} target="_blank" rel="noopener">
                Abrir no WhatsApp
              </a>
            </Button>
            <Button type="button" variant="outline" onClick={cancelar}>
              Gerar outra mensagem
            </Button>
          </div>
        </div>
      )}

      {podeGerar && !mutationGerar.isSuccess && proposta && (
        <form onSubmit={handleSubmit} noValidate className="mb-4 space-y-4">
          {mutationGerar.isError && (
            <Aviso tom="erro" role="alert">
              {mensagemErroApi(mutationGerar.error, abriuWhatsapp ? MENSAGEM_ERRO_REGISTRAR : MENSAGEM_ERRO_GERAR)}
            </Aviso>
          )}

          <Campo rotulo="Enviar para" htmlFor="mensagem-estoque-destino">
            <select
              id="mensagem-estoque-destino"
              className={cn(CLASSES_SELECT, 'w-full')}
              value={contactId}
              onChange={(event) => handleContactChange(event.target.value)}
            >
              {proposta.contatos.map((contato) => (
                <option key={contato.id} value={contato.id}>
                  {contato.nome} — {contato.telefone}
                </option>
              ))}
              <option value={CONTATO_TELEFONE_CLIENTE}>Telefone do cliente ({proposta.telefoneCliente})</option>
            </select>
          </Campo>

          <p className="text-sm text-muted-foreground">
            {proposta.evento
              ? `Evento vigente: ${proposta.evento.nome} — produtos sugeridos: ${proposta.evento.produtosSugeridos.join(', ')}.`
              : 'Sem evento sazonal vigente — mensagem genérica.'}
          </p>

          <Campo
            rotulo="Mensagem"
            htmlFor="mensagem-estoque-texto"
            erro={erroTexto && <span role="alert">{erroTexto}</span>}
          >
            <Textarea
              id="mensagem-estoque-texto"
              value={texto}
              onChange={(event) => {
                setTexto(event.target.value);
                setErroTexto(null);
              }}
              rows={5}
              maxLength={1000}
            />
          </Campo>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
            <Button type="button" variant="outline" onClick={cancelar} disabled={mutationGerar.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={mutationGerar.isPending}>
              {mutationGerar.isPending ? 'Gerando...' : 'Confirmar e abrir no WhatsApp'}
            </Button>
          </div>
        </form>
      )}

      {podeIniciar && mutationProposta.isError && (
        <Aviso tom="erro" role="alert" className="mb-4">
          {mensagemErroApi(mutationProposta.error, MENSAGEM_ERRO_GERAR)}
        </Aviso>
      )}

      <h3 className="mb-2 text-xs font-semibold text-muted-foreground uppercase">Mensagens geradas</h3>
      {mensagensCarregando && <p className="text-sm text-muted-foreground">Carregando mensagens...</p>}

      {mensagensComErro && (
        <Aviso tom="erro" role="alert">
          {mensagemErroApi(erroMensagens, 'Não foi possível carregar as mensagens.')}
        </Aviso>
      )}

      {!mensagensCarregando && !mensagensComErro && (!mensagens || mensagens.length === 0) && (
        <EstadoVazio icone="message-circle">Nenhuma mensagem gerada para este cliente.</EstadoVazio>
      )}

      {!mensagensCarregando && !mensagensComErro && mensagens && mensagens.length > 0 && (
        <ul className="space-y-2">
          {mensagens.map((mensagem) => (
            <li key={mensagem.id} className="rounded-lg bg-muted p-3 text-sm">
              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground max-md:py-3.5">
                  {formatarDataHora(mensagem.dataGeracao)} · {mensagem.autor.nome} ·{' '}
                  {mensagem.evento?.nome ?? 'sem evento'}
                </summary>
                <p className="mt-2 whitespace-pre-wrap">{mensagem.textoFinal}</p>
              </details>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}
