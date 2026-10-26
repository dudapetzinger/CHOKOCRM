/**
 * Histórico de interações do cliente (UC08). A última visita aparece em
 * destaque, num bloco com moldura, e as anteriores vêm abaixo, na linha do
 * tempo, atrás de um filtro de quantidade ("Últimas 3", "Últimas 6" ou
 * "Todas"; o padrão é 3) com a contagem total ao lado. Com uma visita só, há
 * apenas o destaque, sem filtro. O autor pode corrigir a descrição no lugar e
 * anexar a foto que não subiu no momento do check-in, tanto no destaque quanto
 * na lista (os dois usam o mesmo `ItemDaVisita`).
 *
 * Visual do protótipo (Etapa 8): linha do tempo com um ponto por visita, a
 * data e o resultado numa etiqueta (venda em verde, negociação em laranja,
 * sem venda neutra), a etiqueta azul da campanha vinculada (spec 7.7), o
 * pedido da visita com venda ("Pedido · total" e uma
 * linha por item, com o preço gravado no check-in) e a foto em miniatura.
 *
 * O filtro é estado local do componente, não vai para a URL (spec da Etapa
 * 10b, seção 6). Componente de apresentação: não chama a API: recebe os dados
 * e os callbacks da página (ver docs/arquitetura.md).
 */
import { useId, useState } from 'react';
import { Camera, Pencil, ShoppingBag } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ROTULO_RESULTADO, type ResultadoVisita } from '../services/visits';
import type { Visita } from '../services/visits';
import { VisitaFoto } from './VisitaFoto';
import { formatarDataHora } from '../lib/formatarData';
import { formatarMoeda } from '../lib/formatarMoeda';
import { EstadoVazio } from './EstadoVazio';
import { FiltroPilulas, type Opcao } from './FiltroPilulas';
import { Aviso, Etiqueta } from './crm/ui';
import { EtiquetaCampanha } from './crm/EtiquetaCampanha';

const TOM_RESULTADO: Record<ResultadoVisita, 'verde' | 'laranja' | 'neutro'> = {
  VENDA: 'verde',
  NEGOCIACAO: 'laranja',
  SEM_VENDA: 'neutro',
};

/** Quantas visitas anteriores à última aparecem na linha do tempo. */
export type FiltroDeVisitas = 3 | 6 | 'todas';

const OPCOES_FILTRO: Opcao<FiltroDeVisitas>[] = [
  { valor: 3, rotulo: 'Últimas 3' },
  { valor: 6, rotulo: 'Últimas 6' },
  { valor: 'todas', rotulo: 'Todas' },
];

type Props = {
  visitas: Visita[];
  usuarioId: string | undefined;
  onEditarDescricao: (visitaId: string, descricao: string) => Promise<void>;
  onAnexarFoto: (visitaId: string, arquivo: File) => Promise<void>;
};

type PropsDoItem = {
  visita: Visita;
  souAutor: boolean;
  editando: boolean;
  rascunho: string;
  ocupado: boolean;
  onComecarEdicao: () => void;
  onCancelarEdicao: () => void;
  onMudarRascunho: (texto: string) => void;
  onSalvarDescricao: () => void;
  onAnexarFoto: (arquivo: File) => void;
};

/**
 * Conteúdo de uma visita (data, etiquetas, descrição editável, pedido e foto),
 * igual no destaque e na linha do tempo. O estado de edição fica no pai.
 */
function ItemDaVisita({
  visita,
  souAutor,
  editando,
  rascunho,
  ocupado,
  onComecarEdicao,
  onCancelarEdicao,
  onMudarRascunho,
  onSalvarDescricao,
  onAnexarFoto,
}: PropsDoItem) {
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-sm font-medium">{formatarDataHora(visita.dataHora)}</span>
        <Etiqueta tom={TOM_RESULTADO[visita.resultado]}>{ROTULO_RESULTADO[visita.resultado]}</Etiqueta>
        {visita.campanha && <EtiquetaCampanha nome={visita.campanha.nome} />}
        <span className="text-xs text-muted-foreground">
          {visita.contato ? `Contato: ${visita.contato.nome}` : 'Sem contato informado'} · por {visita.autor.nome}
        </span>
      </div>

      {editando ? (
        <div className="mt-2 space-y-2">
          <Textarea
            value={rascunho}
            onChange={(evento) => onMudarRascunho(evento.target.value)}
            rows={3}
            aria-label="Descrição da visita"
          />
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" disabled={ocupado} onClick={onSalvarDescricao}>
              {ocupado ? 'Salvando...' : 'Salvar'}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={onCancelarEdicao}>
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
              onClick={onComecarEdicao}
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
                <span className="shrink-0 tabular-nums">{formatarMoeda(item.quantidade * item.precoUnitario)}</span>
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
                    if (arquivo) onAnexarFoto(arquivo);
                  }}
                />
              </label>
            </Button>
          </div>
        )
      )}
    </div>
  );
}

export function VisitTimeline({ visitas, usuarioId, onEditarDescricao, onAnexarFoto }: Props) {
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [filtro, setFiltro] = useState<FiltroDeVisitas>(3);
  const idDestaque = useId();
  const idAnteriores = useId();

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

  function renderizarItem(visita: Visita) {
    return (
      <ItemDaVisita
        visita={visita}
        souAutor={usuarioId === visita.autor.id}
        editando={editando === visita.id}
        rascunho={rascunho}
        ocupado={ocupado}
        onComecarEdicao={() => {
          setEditando(visita.id);
          setRascunho(visita.descricao);
          setErro(null);
        }}
        onCancelarEdicao={() => setEditando(null)}
        onMudarRascunho={setRascunho}
        onSalvarDescricao={() => void salvarDescricao(visita.id)}
        onAnexarFoto={(arquivo) => void anexarFoto(visita.id, arquivo)}
      />
    );
  }

  const [ultima, ...anteriores] = visitas;
  const anterioresVisiveis = filtro === 'todas' ? anteriores : anteriores.slice(0, filtro);

  return (
    <>
      {erro && (
        <Aviso tom="erro" role="alert" className="mb-4">
          {erro}
        </Aviso>
      )}

      <section aria-labelledby={idDestaque} className="rounded-lg border border-primary/30 bg-primary-soft/40 p-3">
        <h3 id={idDestaque} className="mb-2 text-xs font-semibold text-muted-foreground uppercase">
          Última visita
        </h3>
        {renderizarItem(ultima)}
      </section>

      {anteriores.length > 0 && (
        <>
          <div className="mt-4 mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <FiltroPilulas
              rotulo="Mostrar"
              ariaLabel="Quantas visitas anteriores mostrar"
              opcoes={OPCOES_FILTRO}
              valor={filtro}
              onChange={setFiltro}
              className="mb-0"
            />
            <p className="text-sm text-muted-foreground">{visitas.length} visitas no total</p>
          </div>

          <h3 id={idAnteriores} className="sr-only">
            Visitas anteriores
          </h3>
          <ol aria-labelledby={idAnteriores} className="relative ml-1 space-y-5 border-l pl-5">
            {anterioresVisiveis.map((visita) => (
              <li key={visita.id} className="relative">
                {/* Ponto da linha do tempo: marca sem texto, no laranja vivo */}
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 -left-[25.5px] size-2.5 rounded-full bg-primary-vivo"
                />
                {renderizarItem(visita)}
              </li>
            ))}
          </ol>
        </>
      )}
    </>
  );
}
