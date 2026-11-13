/**
 * Card "Mensagem de estoque" na ficha do cliente: o representante busca a
 * mensagem de consulta de estoque proposta pelo sistema (evento sazonal
 * vigente, se houver), escolhe o contato, revisa o texto e abre no WhatsApp
 * via link `wa.me` montado no próprio toque de "Abrir no WhatsApp". Nada é
 * gravado: não há histórico nem chamada de registro. Com telefone que não
 * serve para o WhatsApp (sem DDD, 0800...) o link vem vazio e nada abre.
 */
import { useState, type FormEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { buscarProposta } from '../services/stockMessages';
import { mensagemErroApi } from '../services/clients';
import { contatosParaWhatsapp, textoSugeridoDoDestino } from '../lib/contatosWhatsapp';
import { linkWhatsapp } from '../lib/telefone';
import { Aviso, Campo, Cartao, CLASSES_SELECT } from './crm/ui';

const MENSAGEM_ERRO_PROPOSTA = 'Não foi possível gerar a mensagem.';
const MENSAGEM_TELEFONE_INVALIDO = 'Este telefone não serve para o WhatsApp.';
const CONTATO_TELEFONE_CLIENTE = '';

type Props = {
  clienteId: string;
};

export function MensagemEstoqueCard({ clienteId }: Props) {
  const [contactId, setContactId] = useState(CONTATO_TELEFONE_CLIENTE);
  const [texto, setTexto] = useState('');
  const [ultimoTextoSugerido, setUltimoTextoSugerido] = useState('');
  const [erroTexto, setErroTexto] = useState<string | null>(null);
  const [erroTelefone, setErroTelefone] = useState(false);

  const mutationProposta = useMutation({
    mutationFn: () => buscarProposta(clienteId),
    onSuccess: (proposta) => {
      const destino = contatosParaWhatsapp(proposta.contatos)[0]?.id ?? CONTATO_TELEFONE_CLIENTE;
      const sugerido = textoSugeridoDoDestino(proposta, destino || null);
      setContactId(destino);
      setTexto(sugerido);
      setUltimoTextoSugerido(sugerido);
      setErroTexto(null);
      setErroTelefone(false);
    },
  });

  const proposta = mutationProposta.data;
  const contatos = proposta ? contatosParaWhatsapp(proposta.contatos) : [];

  function cancelar(): void {
    mutationProposta.reset();
    setErroTexto(null);
    setErroTelefone(false);
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
    setErroTelefone(false);

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

    const telefone =
      contatos.find((contato) => contato.id === contactId)?.telefone ?? proposta?.telefoneCliente ?? '';
    const link = linkWhatsapp(telefone, textoTratado);
    setErroTelefone(link === '');
    // A janela abre no próprio toque (um popup aberto depois é bloqueado no celular).
    if (link) {
      window.open(link, '_blank', 'noopener');
    }
  }

  return (
    <Cartao
      titulo="Mensagem de estoque"
      acao={
        !proposta && (
          <Button size="sm" variant="outline" onClick={() => mutationProposta.mutate()} disabled={mutationProposta.isPending}>
            <MessageCircle aria-hidden="true" />
            {mutationProposta.isPending ? 'Carregando...' : 'Gerar mensagem'}
          </Button>
        )
      }
    >
      {proposta && (
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {erroTelefone && (
            <Aviso tom="erro" role="alert">
              {MENSAGEM_TELEFONE_INVALIDO}
            </Aviso>
          )}

          <Campo rotulo="Enviar para" htmlFor="mensagem-estoque-destino">
            <select
              id="mensagem-estoque-destino"
              className={cn(CLASSES_SELECT, 'w-full')}
              value={contactId}
              onChange={(event) => handleContactChange(event.target.value)}
            >
              {contatos.map((contato) => (
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
            <Button type="button" variant="outline" onClick={cancelar}>
              Cancelar
            </Button>
            <Button type="submit">Abrir no WhatsApp</Button>
          </div>
        </form>
      )}

      {!proposta && mutationProposta.isError && (
        <Aviso tom="erro" role="alert">
          {mensagemErroApi(mutationProposta.error, MENSAGEM_ERRO_PROPOSTA)}
        </Aviso>
      )}
    </Cartao>
  );
}
