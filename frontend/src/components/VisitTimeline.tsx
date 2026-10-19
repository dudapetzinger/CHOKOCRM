/**
 * Histórico de interações do cliente (UC08). Mostra as visitas da mais
 * recente para a mais antiga; o autor pode corrigir a descrição no lugar e
 * anexar a foto que não subiu no momento do check-in.
 *
 * Visual do protótipo (Etapa 8): linha do tempo com um ponto por visita, a
 * data e o resultado numa etiqueta (venda em verde, negociação em laranja,
 * sem venda neutra), a etiqueta azul da campanha vinculada (spec 7.7), o
 * pedido da visita com venda ("Pedido · total" e uma
 * linha por item, com o preço gravado no check-in) e a foto em miniatura.
 *
 * Componente de apresentação: não chama a API: recebe os dados e os
 * callbacks da página (ver docs/arquitetura.md).
 */
import { useState } from 'react';
import { Camera, Pencil, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ROTULO_RESULTADO, type ResultadoVisita } from '../services/visits';
import type { Visita } from '../services/visits';
import { VisitaFoto } from './VisitaFoto';
import { formatarDataHora } from '../lib/formatarData';
import { formatarMoeda } from '../lib/formatarMoeda';
import { EstadoVazio } from './EstadoVazio';
import { Aviso, Etiqueta } from './crm/ui';
import { EtiquetaCampanha } from './crm/EtiquetaCampanha';

const TOM_RESULTADO: Record<ResultadoVisita, 'verde' | 'laranja' | 'neutro'> = {
  VENDA: 'verde',
  NEGOCIACAO: 'laranja',
  SEM_VENDA: 'neutro',
};

type Props = {
  visitas: Visita[];
  usuarioId: string | undefined;
  onEditarDescricao: (visitaId: string, descricao: string) => Promise<void>;
  onAnexarFoto: (visitaId: string, arquivo: File) => Promise<void>;
};

export function VisitTimeline({ visitas, usuarioId, onEditarDescricao, onAnexarFoto }: Props) {
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  if (visitas.length === 0) {
    return (
      <EstadoVazio icone="file-text">Nenhuma visita registrada para este cliente.</EstadoVazio>
    );
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
    <>
      {erro && (
        <Aviso tom="erro" role="alert" className="mb-4">
          {erro}
        </Aviso>
      )}

      <ol className="relative ml-1 space-y-5 border-l pl-5">
        {visitas.map((visita) => {
          const souAutor = usuarioId === visita.autor.id;

          return (
            <li key={visita.id} className="relative">
              {/* Ponto da linha do tempo: marca sem texto, no laranja vivo */}
              <span
                aria-hidden="true"
                className="absolute top-1.5 -left-[25.5px] size-2.5 rounded-full bg-primary-vivo"
              />
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium">{formatarDataHora(visita.dataHora)}</span>
                <Etiqueta tom={TOM_RESULTADO[visita.resultado]}>{ROTULO_RESULTADO[visita.resultado]}</Etiqueta>
                {visita.campanha && <EtiquetaCampanha nome={visita.campanha.nome} />}
                <span className="text-xs text-muted-foreground">
                  {visita.contato ? `Contato: ${visita.contato.nome}` : 'Sem contato informado'} · por{' '}
                  {visita.autor.nome}
                </span>
              </div>

              {editando === visita.id ? (
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={rascunho}
                    onChange={(evento) => setRascunho(evento.target.value)}
                    rows={3}
                    aria-label="Descrição da visita"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" size="sm" disabled={ocupado} onClick={() => void salvarDescricao(visita.id)}>
                      {ocupado ? 'Salvando...' : 'Salvar'}
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditando(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{visita.descricao}</p>
                  {visita.editadoEm && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Descrição editada em {formatarDataHora(visita.editadoEm)}
                    </p>
                  )}
                  {souAutor && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="mt-1 -ml-3 text-muted-foreground"
                      onClick={() => {
                        setEditando(visita.id);
                        setRascunho(visita.descricao);
                        setErro(null);
                      }}
                    >
                      <Pencil aria-hidden="true" />
                      Editar descrição
                    </Button>
                  )}
                </>
              )}

              {visita.itens.length > 0 && (
                <div className="mt-2 rounded-lg bg-muted p-2.5 text-sm">
                  <p id={`pedido-${visita.id}`} className="mb-1 flex items-center gap-1.5 font-medium">
                    {/* Marca sem texto: o laranja vivo vale aqui (spec 6.3) */}
                    <ShoppingBag aria-hidden="true" className="size-4 shrink-0 text-primary-vivo" />
                    Pedido · {formatarMoeda(visita.totalPedido)}
                  </p>
                  <ul aria-labelledby={`pedido-${visita.id}`} className="space-y-0.5">
                    {visita.itens.map((item, indice) => (
                      <li key={`${item.sku}-${indice}`} className="flex justify-between gap-3 text-muted-foreground">
                        <span className="min-w-0">
                          {item.quantidade}× {item.produtoNome}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {formatarMoeda(item.quantidade * item.precoUnitario)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {visita.temFoto ? (
                <VisitaFoto visitaId={visita.id} />
              ) : (
                souAutor && (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-xs text-muted-foreground">Esta visita não tem foto de comprovação.</p>
                    {/* O campo de arquivo fica escondido dentro do rótulo com cara de botão:
                        tocar no rótulo abre a câmera; pelo teclado, o foco vai ao campo e o
                        anel aparece no rótulo. */}
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="focus-within:ring-2 focus-within:ring-ring has-[:disabled]:pointer-events-none has-[:disabled]:opacity-50"
                    >
                      <label>
                        <Camera aria-hidden="true" />
                        Anexar foto
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="sr-only"
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
                    </Button>
                  </div>
                )
              )}
            </li>
          );
        })}
      </ol>
    </>
  );
}
