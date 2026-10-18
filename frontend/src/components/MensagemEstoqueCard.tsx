/**
 * Card "Mensagem de estoque" na ficha do cliente (UC12, Etapa 6A): o
 * representante gera uma mensagem de consulta de estoque com texto proposto
 * pelo sistema (evento sazonal vigente, se houver), revisa e abre no
 * WhatsApp via link `wa.me`; o histórico de mensagens geradas fica visível
 * para todos os papéis (só a geração é exclusiva do representante com
 * cliente ativo, ver `podeGerar` em `ClienteDetalhePage`). Visual do
 * protótipo (Etapa 8): "Gerar mensagem" na ação do cartão e cada mensagem
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
import { EstadoVazio } from './EstadoVazio';
import { Aviso, Campo, Cartao, CLASSES_SELECT } from './crm/ui';

const MENSAGEM_ERRO_GERAR = 'Não foi possível gerar a mensagem.';
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
    setUltimoTextoSugerido('');
  }

  /**
   * Troca "Enviar para" (I2): a saudação sugerida segue o destinatário
   * escolhido, mas só enquanto o representante não tiver editado o texto —
   * se o texto atual ainda é exatamente a última sugestão aplicada, troca
   * pela sugestão do novo destinatário; caso contrário, o texto já editado
   * é preservado.
   */
  function handleContactChange(novoContactId: string): void {
    setContactId(novoContactId);

    const novaSugestao = mutationProposta.data?.textosSugeridos.find(
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
              {mensagemErroApi(mutationGerar.error, MENSAGEM_ERRO_GERAR)}
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
