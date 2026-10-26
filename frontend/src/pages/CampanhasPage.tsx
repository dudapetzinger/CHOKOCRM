/**
 * Campanhas e eventos (spec 7.7), no visual de `routes/campanhas.tsx` do
 * protótipo, até 896 px de largura (largura toda no celular). Todos veem os
 * cartões, em ordem de início: nome, tipo, status (Programada em laranja, Em
 * andamento em verde, Encerrada neutra — calculado no backend pelo dia de
 * hoje em São Paulo), desconto em vermelho, período, descrição, produtos em
 * destaque e as vendas vinculadas, resumidas: por representante para o
 * gestor, "Minhas vendas vinculadas" para o representante (o backend já
 * manda só a linha dele) e, embaixo, as "Metas da campanha" (spec 7.8,
 * `MetasPanel`).
 *
 * No topo, o filtro "Campanha" (`?campanha=<id>`, `replace`; id desconhecido
 * vale "Todas as campanhas"). Com uma campanha escolhida, só o cartão dela
 * aparece e a lista resumida dá lugar a `ResultadosDaCampanha` (tabela por
 * representante e produtos mais vendidos), seguida das metas.
 *
 * Só o gestor tem "Nova campanha ou evento", editar e excluir (o backend
 * também barra). O formulário abre num cartão no topo, para criar e para
 * editar: nome, tipo, início, fim, desconto, descrição e os produtos do
 * catálogo do ERP como botões que ligam e desligam (`aria-pressed`). As
 * regras do backend são conferidas antes de enviar, com as mesmas
 * mensagens, junto do campo. Excluir pede confirmação: as visitas vinculadas
 * continuam no histórico, sem a campanha.
 */
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useAuth } from '../auth/useAuth';
import { EstadoVazio } from '../components/EstadoVazio';
import { Segmentado, type Opcao } from '../components/Segmentado';
import { MetasPanel } from '../components/crm/MetasPanel';
import { ResultadosDaCampanha } from '../components/crm/ResultadosDaCampanha';
import { Aviso, Campo, CLASSES_BOTAO_PERIGO, CLASSES_SELECT, Etiqueta } from '../components/crm/ui';
import { useCampanhas } from '../hooks/useCampanhas';
import { useProdutos } from '../hooks/useDadosErp';
import { formatarDataCalendario } from '../lib/formatarData';
import { formatarMoeda } from '../lib/formatarMoeda';
import { useFocoNoPrimeiroErro } from '../lib/useFoco';
import {
  atualizarCampanha,
  criarCampanha,
  excluirCampanha,
  ROTULO_STATUS,
  ROTULO_TIPO,
  validarCampanha,
  type Campanha,
  type CampanhaInput,
  type ErrosCampanha,
  type StatusCampanha,
  type TipoCampanha,
} from '../services/campaigns';
import { mensagemErroApi } from '../services/clients';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar as campanhas.';
const MENSAGEM_ERRO_SALVAR = 'Não foi possível salvar a campanha.';
const MENSAGEM_ERRO_EXCLUIR = 'Não foi possível excluir a campanha.';
const MENSAGEM_ERRO_PRODUTOS = 'Não foi possível carregar os produtos.';
const PARAMETRO_CAMPANHA = 'campanha';

const TOM_STATUS: Record<StatusCampanha, 'laranja' | 'verde' | 'neutro'> = {
  PROGRAMADA: 'laranja',
  EM_ANDAMENTO: 'verde',
  ENCERRADA: 'neutro',
};

const OPCOES_TIPO: Opcao<TipoCampanha>[] = (['CAMPANHA', 'PROMOCAO', 'EVENTO'] as const).map((tipo) => ({
  valor: tipo,
  rotulo: ROTULO_TIPO[tipo],
}));

/** Hoje no aparelho, `AAAA-MM-DD` (o padrão do início e do fim de uma campanha nova). */
function hojeNoAparelho(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

function textoDasVisitas(visitas: number): string {
  return visitas === 1 ? '1 visita vinculada' : `${visitas} visitas vinculadas`;
}

type Dados = {
  nome: string;
  tipo: TipoCampanha;
  inicio: string;
  fim: string;
  desconto: string;
  descricao: string;
  produtos: string[];
};

function dadosIniciais(campanha: Campanha | null): Dados {
  if (!campanha) {
    const hoje = hojeNoAparelho();
    return { nome: '', tipo: 'CAMPANHA', inicio: hoje, fim: hoje, desconto: '', descricao: '', produtos: [] };
  }
  return {
    nome: campanha.nome,
    tipo: campanha.tipo,
    inicio: campanha.inicio,
    fim: campanha.fim,
    desconto: campanha.desconto === null ? '' : String(campanha.desconto),
    descricao: campanha.descricao,
    produtos: campanha.produtos.map((produto) => produto.sku),
  };
}

/** Cartão do formulário, para criar (`campanha` nula) ou editar. */
function FormularioCampanha({ campanha, aoFechar }: { campanha: Campanha | null; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const [dados, setDados] = useState<Dados>(() => dadosIniciais(campanha));
  const [erros, setErros] = useState<ErrosCampanha>({});
  const { ref: formulario, focarPrimeiroErro } = useFocoNoPrimeiroErro<HTMLFormElement>();
  const { data: produtos, isLoading: carregandoProdutos, isError: erroProdutos } = useProdutos();
  const titulo = campanha ? 'Editar campanha' : 'Nova campanha';
  const campoNome = useRef<HTMLInputElement>(null);

  // Ao abrir (para criar ou editar), o foco vai para o nome: o formulário
  // aparece no topo, e quem editou a partir de um cartão lá embaixo chega nele
  useEffect(() => {
    campoNome.current?.focus();
  }, []);

  const salvar = useMutation({
    mutationFn: (input: CampanhaInput) => (campanha ? atualizarCampanha(campanha.id, input) : criarCampanha(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campanhas'] });
      // O período da campanha pode ter mudado (e com ele o realizado das metas)
      if (campanha) void queryClient.invalidateQueries({ queryKey: ['metas'] });
      toast.success(campanha ? 'Campanha atualizada' : 'Campanha criada — os representantes já podem ver');
      aoFechar();
    },
  });

  function atualizar<C extends keyof Dados>(campo: C, valor: Dados[C]): void {
    setDados((anteriores) => ({ ...anteriores, [campo]: valor }));
    if (campo in erros) setErros((anteriores) => ({ ...anteriores, [campo]: undefined }));
  }

  function alternarProduto(sku: string): void {
    atualizar(
      'produtos',
      dados.produtos.includes(sku) ? dados.produtos.filter((item) => item !== sku) : [...dados.produtos, sku],
    );
  }

  function enviar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    if (salvar.isPending) return;

    const encontrados = validarCampanha(dados);
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) {
      focarPrimeiroErro();
      return;
    }

    const desconto = dados.desconto.trim();
    salvar.mutate({
      nome: dados.nome.trim(),
      tipo: dados.tipo,
      inicio: dados.inicio,
      fim: dados.fim,
      desconto: desconto === '' ? null : Number(desconto),
      descricao: dados.descricao.trim(),
      produtos: dados.produtos,
    });
  }

  return (
    <div className="rounded-xl border bg-card p-5">
      <form
        ref={formulario}
        onSubmit={enviar}
        noValidate
        autoComplete="off"
        aria-labelledby="campanha-formulario-titulo"
        className="space-y-4"
      >
        <h2 id="campanha-formulario-titulo" className="text-base font-semibold">
          {titulo}
        </h2>

        <Campo rotulo="Nome" htmlFor="campanha-nome" erro={erros.nome}>
          <Input
            ref={campoNome}
            id="campanha-nome"
            maxLength={100}
            placeholder="Ex.: Páscoa 2027"
            value={dados.nome}
            onChange={(evento) => atualizar('nome', evento.target.value)}
          />
        </Campo>

        <div className="space-y-1.5">
          {/* O grupo já se chama "Tipo"; o rótulo visível não é lido de novo */}
          <span aria-hidden="true" className="block text-sm font-medium">
            Tipo
          </span>
          <Segmentado
            ariaLabel="Tipo"
            opcoes={OPCOES_TIPO}
            valor={dados.tipo}
            onChange={(tipo) => atualizar('tipo', tipo)}
            larguraTotal
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Campo rotulo="Início" htmlFor="campanha-inicio" erro={erros.inicio}>
            <Input
              id="campanha-inicio"
              type="date"
              value={dados.inicio}
              onChange={(evento) => {
                atualizar('inicio', evento.target.value);
                // O fim depende do início: o erro dele pode ter deixado de valer
                setErros((anteriores) => ({ ...anteriores, fim: undefined }));
              }}
            />
          </Campo>
          <Campo rotulo="Fim" htmlFor="campanha-fim" erro={erros.fim}>
            <Input
              id="campanha-fim"
              type="date"
              min={dados.inicio || undefined}
              value={dados.fim}
              onChange={(evento) => atualizar('fim', evento.target.value)}
            />
          </Campo>
          <Campo rotulo="Desconto (%)" htmlFor="campanha-desconto" erro={erros.desconto}>
            <Input
              id="campanha-desconto"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              step={1}
              value={dados.desconto}
              onChange={(evento) => atualizar('desconto', evento.target.value)}
            />
          </Campo>
        </div>

        <Campo rotulo="Descrição e orientações aos representantes" htmlFor="campanha-descricao">
          <Textarea
            id="campanha-descricao"
            rows={3}
            maxLength={1000}
            value={dados.descricao}
            onChange={(evento) => atualizar('descricao', evento.target.value)}
          />
        </Campo>

        <div role="group" aria-labelledby="campanha-produtos-titulo" className="space-y-1.5">
          <span id="campanha-produtos-titulo" className="block text-sm font-medium">
            Produtos em destaque
          </span>
          {erroProdutos && (
            <Aviso tom="erro" role="alert">
              {MENSAGEM_ERRO_PRODUTOS}
            </Aviso>
          )}
          {carregandoProdutos && <p className="text-sm text-muted-foreground">Carregando produtos...</p>}
          {produtos && (
            <div className="flex flex-wrap gap-2">
              {produtos.map((produto) => {
                const marcado = dados.produtos.includes(produto.sku);
                return (
                  <Button
                    key={produto.sku}
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-pressed={marcado}
                    onClick={() => alternarProduto(produto.sku)}
                    className={cn(
                      marcado && 'border-primary-vivo bg-primary-soft text-brown hover:bg-primary-soft hover:text-brown',
                    )}
                  >
                    {/* O check repete o "marcado" sem depender da cor */}
                    {marcado && <Check aria-hidden="true" />}
                    {produto.nome}
                  </Button>
                );
              })}
            </div>
          )}
        </div>

        {salvar.isError && (
          <Aviso tom="erro" role="alert">
            {mensagemErroApi(salvar.error, MENSAGEM_ERRO_SALVAR)}
          </Aviso>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" className="w-full sm:w-auto" disabled={salvar.isPending}>
            {salvar.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
          <Button type="button" variant="ghost" onClick={aoFechar}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Confirmação de excluir, dentro do cartão; o foco começa em "Cancelar". */
function ConfirmarExclusao({ campanha, aoFechar }: { campanha: Campanha; aoFechar: () => void }) {
  const queryClient = useQueryClient();
  const cancelar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelar.current?.focus();
  }, []);

  const excluir = useMutation({
    mutationFn: () => excluirCampanha(campanha.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campanhas'] });
      // As metas da campanha foram apagadas junto (FK em cascata)
      void queryClient.invalidateQueries({ queryKey: ['metas'] });
      toast.success('Campanha excluída');
      aoFechar();
    },
  });

  return (
    <div
      role="group"
      aria-label={`Excluir ${campanha.nome}`}
      className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-st-red-soft p-3 text-sm"
    >
      {/* O texto ocupa a linha; os dois botões ficam juntos (descem juntos se faltar espaço) */}
      <span className="min-w-0 flex-[1_1_16rem]">
        Excluir “{campanha.nome}”? As visitas vinculadas continuam no histórico, sem a campanha.
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" disabled={excluir.isPending} onClick={() => excluir.mutate()}>
          {excluir.isPending ? 'Excluindo...' : 'Excluir'}
        </Button>
        <Button ref={cancelar} size="sm" variant="ghost" onClick={aoFechar}>
          Cancelar
        </Button>
      </div>
      {excluir.isError && (
        <Aviso tom="erro" role="alert" className="basis-full">
          {mensagemErroApi(excluir.error, MENSAGEM_ERRO_EXCLUIR)}
        </Aviso>
      )}
    </div>
  );
}

/**
 * `detalhado` (a campanha escolhida no filtro) troca a lista resumida de
 * vendas pelos resultados por representante e pelos produtos mais vendidos.
 */
function CartaoCampanha({
  campanha,
  gestor,
  detalhado,
  aoEditar,
}: {
  campanha: Campanha;
  gestor: boolean;
  detalhado: boolean;
  aoEditar: (campanha: Campanha) => void;
}) {
  const [confirmando, setConfirmando] = useState(false);
  const tituloVendas = gestor ? 'Vendas vinculadas por representante' : 'Minhas vendas vinculadas';
  const idTitulo = `campanha-${campanha.id}-titulo`;
  const idVendas = `campanha-${campanha.id}-vendas`;

  return (
    <li className="rounded-xl border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id={idTitulo} className="text-base font-semibold break-words">
              {campanha.nome}
            </h2>
            <Etiqueta>{ROTULO_TIPO[campanha.tipo]}</Etiqueta>
            <Etiqueta tom={TOM_STATUS[campanha.status]}>{ROTULO_STATUS[campanha.status]}</Etiqueta>
            {campanha.desconto ? (
              <Etiqueta tom="vermelho">
                <span aria-hidden="true">−{campanha.desconto}%</span>
                <span className="sr-only">{campanha.desconto}% de desconto</span>
              </Etiqueta>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {formatarDataCalendario(campanha.inicio)} a {formatarDataCalendario(campanha.fim)}
          </p>
        </div>
        {gestor && (
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Editar ${campanha.nome}`}
              className="text-muted-foreground"
              onClick={() => aoEditar(campanha)}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Excluir ${campanha.nome}`}
              aria-expanded={confirmando}
              className={CLASSES_BOTAO_PERIGO}
              onClick={() => setConfirmando(true)}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>

      {gestor && confirmando && <ConfirmarExclusao campanha={campanha} aoFechar={() => setConfirmando(false)} />}

      {campanha.descricao && <p className="mt-2 text-sm whitespace-pre-wrap break-words">{campanha.descricao}</p>}

      {campanha.produtos.length > 0 && (
        <ul aria-label="Produtos em destaque" className="mt-3 flex flex-wrap gap-2">
          {campanha.produtos.map((produto) => (
            <li key={produto.sku}>
              <Etiqueta tom="laranja">{produto.nome}</Etiqueta>
            </li>
          ))}
        </ul>
      )}

      {detalhado ? (
        <ResultadosDaCampanha campanha={campanha} gestor={gestor} />
      ) : (
        <div className="mt-4 border-t pt-4">
          <h3 id={idVendas} className="mb-2 text-sm font-semibold">
            {tituloVendas}
          </h3>
          {campanha.resultados.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum representante ativo.</p>
          ) : (
            <ul aria-labelledby={idVendas} className="divide-y">
              {campanha.resultados.map((linha) => (
                <li key={linha.representante.id} className="flex flex-wrap justify-between gap-x-3 gap-y-1 py-2 text-sm">
                  <span className="min-w-0 break-words">{linha.representante.nome}</span>
                  <span>
                    <b className="font-semibold tabular-nums">{formatarMoeda(linha.vendas)}</b>
                    <span className="ml-2 text-muted-foreground">{textoDasVisitas(linha.visitas)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <MetasPanel campanha={campanha} />
    </li>
  );
}

export function CampanhasPage() {
  const { user } = useAuth();
  const gestor = user?.role === 'GESTOR';
  const { data: campanhas, isLoading, isError, error } = useCampanhas();
  const [busca, setBusca] = useSearchParams();
  // Um id que não está na lista (campanha excluída, link velho) vale como "Todas"
  const escolhida = campanhas?.find((campanha) => campanha.id === busca.get(PARAMETRO_CAMPANHA)) ?? null;
  // `undefined`: fechado; `null`: campanha nova; uma campanha: editando
  const [emEdicao, setEmEdicao] = useState<Campanha | null | undefined>(undefined);
  const botaoNova = useRef<HTMLButtonElement>(null);
  const gatilho = useRef<HTMLElement | null>(null);
  const devolverFoco = useRef(false);

  // Ao fechar o formulário, o foco volta a quem o abriu (o "Editar" do
  // cartão) ou, se ele não existe mais, a "Nova campanha ou evento".
  useEffect(() => {
    if (emEdicao !== undefined || !devolverFoco.current) return;
    devolverFoco.current = false;
    (gatilho.current?.isConnected ? gatilho.current : botaoNova.current)?.focus();
  }, [emEdicao]);

  function abrir(campanha: Campanha | null): void {
    gatilho.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEmEdicao(campanha);
  }

  function fechar(): void {
    devolverFoco.current = true;
    setEmEdicao(undefined);
  }

  // Preserva os outros parâmetros e não enche o histórico; "Todas" tira o parâmetro
  function escolher(id: string): void {
    setBusca(
      (anterior) => {
        const proxima = new URLSearchParams(anterior);
        if (id === '') proxima.delete(PARAMETRO_CAMPANHA);
        else proxima.set(PARAMETRO_CAMPANHA, id);
        return proxima;
      },
      { replace: true },
    );
  }

  const mostrarNova = gestor && emEdicao === undefined;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {((campanhas && campanhas.length > 0) || mostrarNova) && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          {campanhas && campanhas.length > 0 && (
            <div className="flex min-w-0 flex-col gap-1.5 sm:w-80">
              <label htmlFor="campanhas-filtro" className="text-sm font-medium">
                Campanha
              </label>
              <select
                id="campanhas-filtro"
                value={escolhida?.id ?? ''}
                onChange={(evento) => escolher(evento.target.value)}
                className={cn(CLASSES_SELECT, 'w-full min-w-0')}
              >
                <option value="">Todas as campanhas</option>
                {campanhas.map((campanha) => (
                  <option key={campanha.id} value={campanha.id}>
                    {campanha.nome} · {ROTULO_STATUS[campanha.status]}
                  </option>
                ))}
              </select>
            </div>
          )}
          {mostrarNova && (
            <Button ref={botaoNova} className="w-full sm:w-auto" onClick={() => abrir(null)}>
              <Plus aria-hidden="true" />
              Nova campanha ou evento
            </Button>
          )}
        </div>
      )}

      {gestor && emEdicao !== undefined && (
        <FormularioCampanha key={emEdicao?.id ?? 'nova'} campanha={emEdicao} aoFechar={fechar} />
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando campanhas...</p>}

      {isError && (
        <Aviso tom="erro" role="alert">
          {mensagemErroApi(error, MENSAGEM_ERRO_CARREGAR)}
        </Aviso>
      )}

      {campanhas && campanhas.length === 0 && (
        <EstadoVazio icone="megaphone">Nenhuma campanha cadastrada.</EstadoVazio>
      )}

      {campanhas && campanhas.length > 0 && (
        <ul aria-label="Campanhas e eventos" className="space-y-3">
          {(escolhida ? [escolhida] : campanhas).map((campanha) => (
            <CartaoCampanha
              key={campanha.id}
              campanha={campanha}
              gestor={gestor}
              detalhado={escolhida !== null}
              aoEditar={abrir}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

export default CampanhasPage;
