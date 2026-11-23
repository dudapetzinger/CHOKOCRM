/**
 * Campanhas e eventos, no visual de `routes/campanhas.tsx` do
 * protótipo, até 896 px de largura (largura toda no celular). As campanhas
 * ficam separadas em três abas pela situação, que o backend calcula pelo dia
 * de hoje em São Paulo: "Em andamento" (a que abre), "Programadas" e
 * "Encerradas", cada uma com a contagem. A aba fica na URL (`?aba=`, a de
 * "Em andamento" deixa a URL limpa). Dentro da aba, os cartões vêm em ordem
 * de início: nome, tipo, status (Programada em laranja, Em andamento em
 * verde, Encerrada neutra), desconto em vermelho, período, descrição,
 * produtos em destaque e as vendas vinculadas, resumidas: por representante
 * para o gestor, "Minhas vendas vinculadas" para o representante (o backend
 * já manda só a linha dele) e, embaixo, as "Metas da campanha"
 * (`MetasPanel`).
 *
 * No topo, o filtro "Campanha" lista as campanhas da aba aberta
 * (`?campanha=<id>`, `replace`; id desconhecido vale "Todas as campanhas").
 * Com uma campanha escolhida, só o cartão dela aparece, na aba da situação
 * dela, e a lista resumida dá lugar a `ResultadosDaCampanha` (tabela por
 * representante e produtos mais vendidos), seguida das metas. Trocar de aba
 * desfaz a escolha.
 *
 * Só o gestor tem "Nova campanha ou evento", editar, encerrar e excluir (o
 * backend também barra). O formulário abre num cartão no topo, para criar e
 * para editar: nome, tipo, início, fim, desconto, descrição e os produtos do
 * catálogo do ERP como botões que ligam e desligam (`aria-pressed`). As
 * regras do backend são conferidas antes de enviar, com as mesmas
 * mensagens, junto do campo. "Encerrar" aparece só na campanha em andamento
 * e pede confirmação: o backend troca a data de fim para ontem, a campanha
 * passa para a aba "Encerradas" e as metas dela acompanham. Excluir também
 * pede confirmação: as visitas vinculadas continuam no histórico, sem a
 * campanha. O "hoje" padrão da campanha nova vem de `agora()`
 * (`lib/relogio.ts`, relógio de demonstração).
 *
 * Na campanha encerrada, o botão "?" abre a análise de como ela foi
 * (`AnaliseDaCampanha`), para o gestor e para o representante.
 */
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Check, CircleHelp, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { useBlocoRecolhivel } from '@/lib/blocoRecolhivel';
import { usePainelLateral } from '@/lib/usePainelLateral';
import { useAuth } from '../auth/useAuth';
import { Abas, PainelDaAba, type Aba } from '../components/Abas';
import { EstadoVazio } from '../components/EstadoVazio';
import { Segmentado, type Opcao } from '../components/Segmentado';
import { AnaliseDaCampanha } from '../components/crm/AnaliseDaCampanha';
import { MetasPanel } from '../components/crm/MetasPanel';
import { ResultadosDaCampanha } from '../components/crm/ResultadosDaCampanha';
import { Aviso, BotaoRecolher, Campo, CLASSES_BOTAO_PERIGO, CLASSES_SELECT, Etiqueta } from '../components/crm/ui';
import { useCampanhas } from '../hooks/useCampanhas';
import { useProdutos } from '../hooks/useDadosErp';
import { formatarDataCalendario } from '../lib/formatarData';
import { formatarMoeda } from '../lib/formatarMoeda';
import { useFocoNoPrimeiroErro } from '../lib/useFoco';
import {
  atualizarCampanha,
  criarCampanha,
  encerrarCampanha,
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
import { agora as agoraDoRelogio } from '../lib/relogio';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar as campanhas.';
const MENSAGEM_ERRO_SALVAR = 'Não foi possível salvar a campanha.';
const MENSAGEM_ERRO_EXCLUIR = 'Não foi possível excluir a campanha.';
const MENSAGEM_ERRO_ENCERRAR = 'Não foi possível encerrar a campanha.';
const MENSAGEM_ERRO_PRODUTOS = 'Não foi possível carregar os produtos.';
const PARAMETRO_CAMPANHA = 'campanha';
const PARAMETRO_ABA = 'aba';

/** As abas da tela, na ordem em que aparecem. A primeira é a que abre. */
type AbaDeCampanhas = 'andamento' | 'programadas' | 'encerradas';
const ABAS_DE_CAMPANHAS: readonly AbaDeCampanhas[] = ['andamento', 'programadas', 'encerradas'];
const ABA_PADRAO: AbaDeCampanhas = 'andamento';

/** Em que aba fica a campanha de cada situação. */
const ABA_DO_STATUS: Record<StatusCampanha, AbaDeCampanhas> = {
  EM_ANDAMENTO: 'andamento',
  PROGRAMADA: 'programadas',
  ENCERRADA: 'encerradas',
};

const ROTULO_DA_ABA: Record<AbaDeCampanhas, string> = {
  andamento: 'Em andamento',
  programadas: 'Programadas',
  encerradas: 'Encerradas',
};

const VAZIO_DA_ABA: Record<AbaDeCampanhas, string> = {
  andamento: 'Nenhuma campanha em andamento.',
  programadas: 'Nenhuma campanha programada.',
  encerradas: 'Nenhuma campanha encerrada.',
};

const TOM_STATUS: Record<StatusCampanha, 'laranja' | 'verde' | 'neutro'> = {
  PROGRAMADA: 'laranja',
  EM_ANDAMENTO: 'verde',
  ENCERRADA: 'neutro',
};

const OPCOES_TIPO: Opcao<TipoCampanha>[] = (['CAMPANHA', 'PROMOCAO', 'EVENTO'] as const).map((tipo) => ({
  valor: tipo,
  rotulo: ROTULO_TIPO[tipo],
}));

/** Hoje no relógio do sistema, `AAAA-MM-DD` (o padrão do início e do fim de uma campanha nova). */
function hojeNoAparelho(): string {
  const agora = agoraDoRelogio();
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
function FormularioCampanha({
  campanha,
  aoSalvar,
  aoFechar,
}: {
  campanha: Campanha | null;
  /** Recebe a campanha como o backend a gravou (a situação pode ter mudado com as datas). */
  aoSalvar: (salva: Campanha) => void;
  aoFechar: () => void;
}) {
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
    onSuccess: (salva) => {
      void queryClient.invalidateQueries({ queryKey: ['campanhas'] });
      // O período da campanha pode ter mudado (e com ele as datas e o realizado das metas)
      if (campanha) void queryClient.invalidateQueries({ queryKey: ['metas'] });
      toast.success(campanha ? 'Campanha atualizada' : 'Campanha criada. Os representantes já podem ver.');
      aoSalvar(salva);
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

/**
 * Caixa de confirmação dentro do cartão, usada por excluir e por encerrar:
 * a pergunta, o botão que confirma e "Cancelar", onde o foco começa (um
 * Enter distraído não confirma). O erro do backend aparece embaixo e a
 * caixa continua aberta.
 */
function Confirmacao({
  rotulo,
  children,
  acao,
  acaoPendente,
  perigo = false,
  pendente,
  erro,
  aoConfirmar,
  aoFechar,
}: {
  /** O nome do grupo para o leitor de tela: "Excluir Natal". */
  rotulo: string;
  /** A pergunta e o que acontece ao confirmar. */
  children: ReactNode;
  acao: string;
  acaoPendente: string;
  /** Vermelho, para o que não tem volta. */
  perigo?: boolean;
  pendente: boolean;
  /** A mensagem do erro, já pronta para mostrar; `null` sem erro. */
  erro: string | null;
  aoConfirmar: () => void;
  aoFechar: () => void;
}) {
  const cancelar = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelar.current?.focus();
  }, []);

  return (
    <div
      role="group"
      aria-label={rotulo}
      className={cn(
        'mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg p-3 text-sm',
        perigo ? 'bg-st-red-soft' : 'bg-muted',
      )}
    >
      {/* O texto ocupa a linha; os dois botões ficam juntos (descem juntos se faltar espaço) */}
      <span className="min-w-0 flex-[1_1_16rem]">{children}</span>
      <div className="flex gap-2">
        <Button size="sm" variant={perigo ? 'destructive' : 'default'} disabled={pendente} onClick={aoConfirmar}>
          {pendente ? acaoPendente : acao}
        </Button>
        <Button ref={cancelar} size="sm" variant="ghost" onClick={aoFechar}>
          Cancelar
        </Button>
      </div>
      {erro !== null && (
        <Aviso tom="erro" role="alert" className="basis-full">
          {erro}
        </Aviso>
      )}
    </div>
  );
}

/** Confirmação de excluir, dentro do cartão. */
function ConfirmarExclusao({ campanha, aoFechar }: { campanha: Campanha; aoFechar: () => void }) {
  const queryClient = useQueryClient();

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
    <Confirmacao
      rotulo={`Excluir ${campanha.nome}`}
      acao="Excluir"
      acaoPendente="Excluindo..."
      perigo
      pendente={excluir.isPending}
      erro={excluir.isError ? mensagemErroApi(excluir.error, MENSAGEM_ERRO_EXCLUIR) : null}
      aoConfirmar={() => excluir.mutate()}
      aoFechar={aoFechar}
    >
      Excluir “{campanha.nome}”? As visitas vinculadas continuam no histórico, sem a campanha.
    </Confirmacao>
  );
}

/**
 * Confirmação de encerrar uma campanha em andamento. Quem troca a data de
 * fim e ajusta as metas é o backend; aqui a tela só pede, avisa e recarrega
 * as campanhas e as metas. Com a lista recarregada, a campanha passa para a
 * aba "Encerradas".
 */
function ConfirmarEncerramento({ campanha, aoFechar }: { campanha: Campanha; aoFechar: () => void }) {
  const queryClient = useQueryClient();

  const encerrar = useMutation({
    mutationFn: () => encerrarCampanha(campanha.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['campanhas'] });
      // As metas da campanha acompanharam a nova data de fim
      void queryClient.invalidateQueries({ queryKey: ['metas'] });
      toast.success('Campanha encerrada. Ela está na aba Encerradas.');
      aoFechar();
    },
  });

  return (
    <Confirmacao
      rotulo={`Encerrar ${campanha.nome}`}
      acao="Encerrar"
      acaoPendente="Encerrando..."
      pendente={encerrar.isPending}
      erro={encerrar.isError ? mensagemErroApi(encerrar.error, MENSAGEM_ERRO_ENCERRAR) : null}
      aoConfirmar={() => encerrar.mutate()}
      aoFechar={aoFechar}
    >
      Encerrar “{campanha.nome}” agora? A data de fim passa a ser ontem e as metas dela acompanham. As visitas e as
      vendas já vinculadas continuam valendo para a análise.
    </Confirmacao>
  );
}

/**
 * `detalhado` (a campanha escolhida no filtro) troca a lista resumida de
 * vendas pelos resultados por representante e pelos produtos mais vendidos.
 * As ações dependem da situação: "Encerrar" só na campanha em andamento (e
 * só para o gestor) e o "?" da análise só na encerrada. Com a campanha
 * aberta no formulário de edição (`editando`), o "Encerrar" some: salvar o
 * formulário, que ainda tem as datas antigas, desfaria o encerramento.
 */
function CartaoCampanha({
  campanha,
  gestor,
  detalhado,
  editando,
  aoEditar,
}: {
  campanha: Campanha;
  gestor: boolean;
  detalhado: boolean;
  editando: boolean;
  aoEditar: (campanha: Campanha) => void;
}) {
  // Qual confirmação está aberta no cartão; `null`: nenhuma
  const [confirmando, setConfirmando] = useState<'excluir' | 'encerrar' | null>(null);
  const analise = usePainelLateral<true>();
  const tituloVendas = gestor ? 'Vendas vinculadas por representante' : 'Minhas vendas vinculadas';
  const idTitulo = `campanha-${campanha.id}-titulo`;
  const idVendas = `campanha-${campanha.id}-vendas`;
  const idConteudo = `campanha-${campanha.id}-conteudo`;
  const { aberto, alternar } = useBlocoRecolhivel(`campanha-${campanha.id}`);

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
        <div className="flex flex-wrap items-center justify-end gap-1">
          {gestor && campanha.status === 'EM_ANDAMENTO' && !editando && (
            <Button
              size="sm"
              variant="outline"
              aria-label={`Encerrar ${campanha.nome}`}
              aria-expanded={confirmando === 'encerrar'}
              onClick={() => setConfirmando('encerrar')}
            >
              Encerrar
            </Button>
          )}
          {campanha.status === 'ENCERRADA' && (
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Ver análise de ${campanha.nome}`}
              title="Como foi a campanha"
              className="text-muted-foreground"
              onClick={(evento) => analise.abrir(true, evento.currentTarget)}
            >
              <CircleHelp aria-hidden="true" />
            </Button>
          )}
          {gestor && (
            <>
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
                aria-expanded={confirmando === 'excluir'}
                className={CLASSES_BOTAO_PERIGO}
                onClick={() => setConfirmando('excluir')}
              >
                <Trash2 aria-hidden="true" />
              </Button>
            </>
          )}
          <BotaoRecolher aberto={aberto} onAlternar={alternar} idTitulo={idTitulo} idConteudo={idConteudo} />
        </div>
      </div>

      {gestor && confirmando === 'excluir' && (
        <ConfirmarExclusao campanha={campanha} aoFechar={() => setConfirmando(null)} />
      )}
      {gestor && confirmando === 'encerrar' && !editando && (
        <ConfirmarEncerramento campanha={campanha} aoFechar={() => setConfirmando(null)} />
      )}
      {analise.escolhido && <AnaliseDaCampanha campanha={campanha} gestor={gestor} aoFechar={analise.fechar} />}

      <div id={idConteudo} hidden={!aberto}>
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
      </div>
    </li>
  );
}

export function CampanhasPage() {
  const { user } = useAuth();
  const gestor = user?.role === 'GESTOR';
  const { data: campanhas, isLoading, isError, error } = useCampanhas();
  const [busca, setBusca] = useSearchParams();
  const idDasAbas = useId();
  // Um id que não está na lista (campanha excluída, link velho) vale como "Todas"
  const escolhida = campanhas?.find((campanha) => campanha.id === busca.get(PARAMETRO_CAMPANHA)) ?? null;
  // A campanha escolhida manda na aba (um link `?campanha=` abre na situação dela);
  // sem escolha, vale o `?aba=` da URL, e um valor desconhecido cai na aba padrão.
  const abaDaUrl = ABAS_DE_CAMPANHAS.find((aba) => aba === busca.get(PARAMETRO_ABA)) ?? ABA_PADRAO;
  const abaAtual = escolhida ? ABA_DO_STATUS[escolhida.status] : abaDaUrl;
  const campanhasDaAba = (campanhas ?? []).filter((campanha) => ABA_DO_STATUS[campanha.status] === abaAtual);
  const abas: readonly Aba<AbaDeCampanhas>[] = ABAS_DE_CAMPANHAS.map((aba) => ({
    valor: aba,
    rotulo: ROTULO_DA_ABA[aba],
    contagem: (campanhas ?? []).filter((campanha) => ABA_DO_STATUS[campanha.status] === aba).length,
  }));
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

  /**
   * Escreve a aba e a campanha escolhida na URL de uma vez só. Preserva os
   * outros parâmetros e não enche o histórico; a aba padrão e "Todas as
   * campanhas" tiram o parâmetro, para a URL limpa continuar sendo a da
   * primeira aba.
   */
  function irPara(aba: AbaDeCampanhas, campanhaId: string): void {
    setBusca(
      (anterior) => {
        const proxima = new URLSearchParams(anterior);
        if (aba === ABA_PADRAO) proxima.delete(PARAMETRO_ABA);
        else proxima.set(PARAMETRO_ABA, aba);
        if (campanhaId === '') proxima.delete(PARAMETRO_CAMPANHA);
        else proxima.set(PARAMETRO_CAMPANHA, campanhaId);
        return proxima;
      },
      { replace: true },
    );
  }

  // O filtro lista as campanhas da aba aberta: a escolha não muda de aba
  function escolher(id: string): void {
    irPara(abaAtual, id);
  }

  // Trocar de aba desfaz a escolha: a campanha escolhida é de outra situação
  function trocarAba(aba: AbaDeCampanhas): void {
    irPara(aba, '');
  }

  // A campanha criada ou editada pode ter outra situação (as datas mandam): a tela vai para a aba dela
  function mostrarSalva(salva: Campanha): void {
    irPara(ABA_DO_STATUS[salva.status], escolhida ? salva.id : '');
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
                {campanhasDaAba.map((campanha) => (
                  <option key={campanha.id} value={campanha.id}>
                    {campanha.nome}
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
        <FormularioCampanha
          key={emEdicao?.id ?? 'nova'}
          campanha={emEdicao}
          aoSalvar={mostrarSalva}
          aoFechar={fechar}
        />
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
        <>
          <Abas
            idBase={idDasAbas}
            ariaLabel="Situação das campanhas"
            abas={abas}
            valor={abaAtual}
            onChange={trocarAba}
          />
          <PainelDaAba idBase={idDasAbas} valor={abaAtual}>
            {campanhasDaAba.length === 0 ? (
              <EstadoVazio icone="megaphone">{VAZIO_DA_ABA[abaAtual]}</EstadoVazio>
            ) : (
              <ul aria-label="Campanhas e eventos" className="space-y-3">
                {(escolhida ? [escolhida] : campanhasDaAba).map((campanha) => (
                  <CartaoCampanha
                    key={campanha.id}
                    campanha={campanha}
                    gestor={gestor}
                    detalhado={escolhida !== null}
                    editando={emEdicao?.id === campanha.id}
                    aoEditar={abrir}
                  />
                ))}
              </ul>
            )}
          </PainelDaAba>
        </>
      )}
    </div>
  );
}

export default CampanhasPage;
