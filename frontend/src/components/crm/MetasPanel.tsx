/**
 * Metas de visitas e vendas (spec 7.8; `MetasPanel` de `crm/metas.tsx` do
 * protótipo). Sem `campanha`, é o bloco "Metas de visitas e vendas" do
 * Painel (cartão próprio, título de nível 2), com as metas sem campanha —
 * para o gestor, filtradas pelo `representanteId` escolhido. Com `campanha`,
 * é a área "Metas da campanha" dentro do cartão da campanha (título de nível
 * 3), com as metas daquela campanha. O representante recebe do backend só
 * as próprias e não vê criar, editar nem excluir (o backend também barra).
 * No Painel, o `periodo` escolhido limita a lista às metas que cruzam a janela
 * (Etapa 9); sem `periodo`, todas. No Painel do representante (Etapa 9, spec
 * 6.3), o bloco tem a largura das metas a partir de 768 px: colunas de 20 rem,
 * no máximo duas (~22 rem com uma meta, ~43 rem com duas ou mais); para o
 * gestor e na campanha, a largura toda.
 *
 * Cada meta é um cartão (uma coluna no celular, duas a partir de 768 px)
 * com o representante, a periodicidade, o período e as barras de visitas e
 * de vendas, com o realizado calculado no backend; cada barra abre o balão
 * (Etapa 9) com os clientes do realizado — as visitas de cada um e, nas
 * vendas, só os que compraram, com o valor. O formulário abre num
 * cartão acima da lista, para criar e para editar: representante (os
 * ativos), periodicidade (semanal, mensal ou período personalizado; não
 * aparece na meta de campanha), início, fim (travado e calculado na semanal
 * e na mensal), meta de visitas e meta de vendas. As regras do backend são
 * conferidas antes de enviar, com as mesmas mensagens, junto do campo.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Target, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useAuth } from '../../auth/useAuth';
import { useMetas } from '../../hooks/useMetas';
import { useRepresentantes } from '../../hooks/useRepresentantes';
import { formatarDataCalendario } from '../../lib/formatarData';
import { formatarMoeda } from '../../lib/formatarMoeda';
import type { Periodo } from '../../lib/periodo';
import { useFocoNoPrimeiroErro } from '../../lib/useFoco';
import { mensagemErroApi } from '../../services/clients';
import {
  atualizarMeta,
  criarMeta,
  excluirMeta,
  periodoDaMeta,
  ROTULO_PERIODO,
  validarMeta,
  type ErrosMeta,
  type Meta,
  type MetaInput,
  type PeriodoMeta,
} from '../../services/goals';
import { Segmentado, type Opcao } from '../Segmentado';
import { BarraProgresso } from './BarraProgresso';
import type { ConteudoDoBalao } from './graficos/BalaoDoGrafico';
import { Aviso, Campo, CLASSES_BOTAO_PERIGO, CLASSES_SELECT, Etiqueta } from './ui';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar as metas.';
const MENSAGEM_ERRO_SALVAR = 'Não foi possível salvar a meta.';
const MENSAGEM_ERRO_EXCLUIR = 'Não foi possível excluir a meta.';

type PeriodoLivre = Exclude<PeriodoMeta, 'CAMPANHA'>;

const OPCOES_PERIODO: Opcao<PeriodoLivre>[] = [
  { valor: 'SEMANAL', rotulo: 'Semanal' },
  { valor: 'MENSAL', rotulo: 'Mensal' },
  // Curto na tela (cabe em 320 px), completo para o leitor de tela
  { valor: 'PERSONALIZADO', rotulo: 'Personalizado', rotuloAcessivel: 'Período personalizado' },
];

export type CampanhaDaMeta = { id: string; inicio: string; fim: string };

/** Hoje no aparelho, `AAAA-MM-DD` (a base do período de uma meta nova). */
function hojeNoAparelho(): string {
  const agora = new Date();
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

function descreverPeriodo(meta: Pick<Meta, 'inicio' | 'fim'>): string {
  return `${formatarDataCalendario(meta.inicio)} a ${formatarDataCalendario(meta.fim)}`;
}

type Dados = {
  representanteId: string;
  periodo: PeriodoMeta;
  inicio: string;
  fim: string;
  metaVisitas: string;
  metaVendas: string;
};

function dadosIniciais(meta: Meta | null, campanha: CampanhaDaMeta | undefined, representanteId: string): Dados {
  if (meta) {
    return {
      representanteId: meta.representante.id,
      periodo: meta.periodo,
      inicio: meta.inicio,
      fim: meta.fim,
      metaVisitas: String(meta.metaVisitas),
      metaVendas: String(meta.metaVendas),
    };
  }
  const periodo = campanha
    ? { periodo: 'CAMPANHA' as const, inicio: campanha.inicio, fim: campanha.fim }
    : { periodo: 'MENSAL' as const, ...periodoDaMeta('MENSAL', hojeNoAparelho()) };
  return { representanteId, ...periodo, metaVisitas: '0', metaVendas: '0' };
}

/** Período calculado: semanal e mensal travam o fim. */
function periodoCalculado(periodo: PeriodoMeta): periodo is 'SEMANAL' | 'MENSAL' {
  return periodo === 'SEMANAL' || periodo === 'MENSAL';
}

/** Cartão do formulário, para criar (`meta` nula) ou editar. */
function FormularioMeta({
  meta,
  campanha,
  representantePadrao,
  aoFechar,
}: {
  meta: Meta | null;
  campanha?: CampanhaDaMeta;
  representantePadrao?: string;
  aoFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const idBase = useId();
  const { data: representantes } = useRepresentantes();
  const [dados, setDados] = useState<Dados>(() => dadosIniciais(meta, campanha, representantePadrao ?? ''));
  const [erros, setErros] = useState<ErrosMeta>({});
  const { ref: formulario, focarPrimeiroErro } = useFocoNoPrimeiroErro<HTMLFormElement>();
  const campoRepresentante = useRef<HTMLSelectElement>(null);
  const titulo = meta ? 'Editar meta' : 'Nova meta';
  const idTitulo = `${idBase}-titulo`;
  // Um nível abaixo do título do bloco (h2 no Painel, h3 no cartão da campanha)
  const Titulo = campanha ? 'h4' : 'h3';

  // Ao abrir, o foco vai para o primeiro campo
  useEffect(() => {
    campoRepresentante.current?.focus();
  }, []);

  // Meta nova sem representante escolhido: o primeiro ativo, quando a lista chega
  useEffect(() => {
    if (meta || !representantes || representantes.length === 0) return;
    setDados((anteriores) =>
      anteriores.representanteId ? anteriores : { ...anteriores, representanteId: representantes[0]!.id },
    );
  }, [meta, representantes]);

  // O representante de uma meta existente que foi inativado continua na lista
  const opcoes = [...(representantes ?? []).map((representante) => ({ ...representante, inativo: false }))];
  if (meta && !opcoes.some((opcao) => opcao.id === meta.representante.id)) {
    opcoes.push({ ...meta.representante, inativo: true });
  }

  const salvar = useMutation({
    mutationFn: (input: MetaInput) => (meta ? atualizarMeta(meta.id, input) : criarMeta(input)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['metas'] });
      toast.success('Meta salva');
      aoFechar();
    },
  });

  function limparErro(campo: keyof ErrosMeta): void {
    if (erros[campo]) setErros((anteriores) => ({ ...anteriores, [campo]: undefined }));
  }

  function trocarPeriodo(periodo: PeriodoLivre): void {
    setDados((anteriores) => ({
      ...anteriores,
      periodo,
      ...(periodoCalculado(periodo) ? periodoDaMeta(periodo, anteriores.inicio || hojeNoAparelho()) : {}),
    }));
    setErros((anteriores) => ({ ...anteriores, inicio: undefined, fim: undefined }));
  }

  function trocarInicio(inicio: string): void {
    setDados((anteriores) => ({
      ...anteriores,
      ...(periodoCalculado(anteriores.periodo) && inicio ? periodoDaMeta(anteriores.periodo, inicio) : { inicio }),
    }));
    // O fim depende do início: o erro dele pode ter deixado de valer
    setErros((anteriores) => ({ ...anteriores, inicio: undefined, fim: undefined }));
  }

  function enviar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    if (salvar.isPending) return;

    const encontrados = validarMeta(dados, campanha);
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) {
      focarPrimeiroErro();
      return;
    }

    salvar.mutate({
      representanteId: dados.representanteId,
      periodo: dados.periodo,
      inicio: dados.inicio,
      fim: dados.fim,
      metaVisitas: Number(dados.metaVisitas.trim()),
      metaVendas: Number(dados.metaVendas.trim().replace(',', '.')),
      campanhaId: campanha?.id ?? null,
    });
  }

  const fimTravado = periodoCalculado(dados.periodo);

  return (
    <div className="rounded-lg border bg-card p-4">
      <form
        ref={formulario}
        onSubmit={enviar}
        noValidate
        autoComplete="off"
        aria-labelledby={idTitulo}
        className="space-y-4"
      >
        <Titulo id={idTitulo} className="text-sm font-semibold">
          {titulo}
        </Titulo>

        <Campo rotulo="Representante" htmlFor={`${idBase}-representante`} erro={erros.representanteId}>
          <select
            ref={campoRepresentante}
            id={`${idBase}-representante`}
            className={cn(CLASSES_SELECT, 'w-full min-w-0')}
            value={dados.representanteId}
            onChange={(evento) => {
              setDados((anteriores) => ({ ...anteriores, representanteId: evento.target.value }));
              limparErro('representanteId');
            }}
          >
            {dados.representanteId === '' && <option value="">Escolha um representante</option>}
            {opcoes.map((opcao) => (
              <option key={opcao.id} value={opcao.id}>
                {opcao.inativo ? `${opcao.nome} (inativo)` : opcao.nome}
              </option>
            ))}
          </select>
        </Campo>

        {!campanha && (
          <div className="space-y-1.5">
            {/* O grupo já se chama "Periodicidade"; o rótulo visível não é lido de novo */}
            <span aria-hidden="true" className="block text-sm font-medium">
              Periodicidade
            </span>
            <Segmentado
              ariaLabel="Periodicidade"
              opcoes={OPCOES_PERIODO}
              valor={dados.periodo as PeriodoLivre}
              onChange={trocarPeriodo}
              larguraTotal
            />
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="Início" htmlFor={`${idBase}-inicio`} erro={erros.inicio}>
            <Input
              id={`${idBase}-inicio`}
              type="date"
              min={campanha?.inicio}
              max={campanha?.fim}
              value={dados.inicio}
              onChange={(evento) => trocarInicio(evento.target.value)}
            />
          </Campo>
          <Campo
            rotulo="Fim"
            htmlFor={`${idBase}-fim`}
            ajuda={fimTravado ? `Calculado pela periodicidade (${ROTULO_PERIODO[dados.periodo].toLowerCase()}).` : undefined}
            erro={erros.fim}
          >
            <Input
              id={`${idBase}-fim`}
              type="date"
              disabled={fimTravado}
              min={dados.inicio || undefined}
              max={campanha?.fim}
              value={dados.fim}
              onChange={(evento) => {
                const fim = evento.target.value;
                setDados((anteriores) => ({ ...anteriores, fim }));
                limparErro('fim');
              }}
            />
          </Campo>
          <Campo rotulo="Meta de visitas" htmlFor={`${idBase}-visitas`} erro={erros.metaVisitas}>
            <Input
              id={`${idBase}-visitas`}
              type="number"
              inputMode="numeric"
              min={0}
              step={1}
              value={dados.metaVisitas}
              onChange={(evento) => {
                const metaVisitas = evento.target.value;
                setDados((anteriores) => ({ ...anteriores, metaVisitas }));
                limparErro('metaVisitas');
              }}
            />
          </Campo>
          <Campo rotulo="Meta de vendas (R$)" htmlFor={`${idBase}-vendas`} erro={erros.metaVendas}>
            <Input
              id={`${idBase}-vendas`}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              value={dados.metaVendas}
              onChange={(evento) => {
                const metaVendas = evento.target.value;
                setDados((anteriores) => ({ ...anteriores, metaVendas }));
                limparErro('metaVendas');
              }}
            />
          </Campo>
        </div>

        {salvar.isError && (
          <Aviso tom="erro" role="alert">
            {mensagemErroApi(salvar.error, MENSAGEM_ERRO_SALVAR)}
          </Aviso>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" className="w-full sm:w-auto" disabled={salvar.isPending}>
            {salvar.isPending ? 'Salvando...' : 'Salvar meta'}
          </Button>
          <Button type="button" variant="ghost" onClick={aoFechar}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}

/** "Visitas · 6 de 20" e os clientes visitados, com as visitas de cada um. */
function balaoDeVisitas({ realizado, metaVisitas }: Meta): ConteudoDoBalao {
  return {
    titulo: `Visitas · ${realizado.visitas} de ${metaVisitas}`,
    linhas: realizado.clientes
      .filter(({ visitas }) => visitas > 0)
      .map(({ nomeFantasia, visitas }) => ({
        nome: nomeFantasia,
        detalhe: `${visitas} ${visitas === 1 ? 'visita' : 'visitas'}`,
      })),
  };
}

/** "Vendas · R$ 4.200,00 de R$ 6.000,00" e só os clientes que compraram, com o valor. */
function balaoDeVendas({ realizado, metaVendas }: Meta): ConteudoDoBalao {
  return {
    titulo: `Vendas · ${formatarMoeda(realizado.vendas)} de ${formatarMoeda(metaVendas)}`,
    linhas: realizado.clientes
      .filter(({ vendas }) => vendas > 0)
      .map(({ nomeFantasia, vendas }) => ({ nome: nomeFantasia, detalhe: formatarMoeda(vendas) })),
  };
}

function CartaoMeta({ meta, gestor, aoEditar }: { meta: Meta; gestor: boolean; aoEditar: (meta: Meta) => void }) {
  const queryClient = useQueryClient();
  const descricao = `${meta.representante.nome}, ${descreverPeriodo(meta)}`;

  const excluir = useMutation({
    mutationFn: () => excluirMeta(meta.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['metas'] });
      toast.success('Meta excluída');
    },
    onError: (erro) => {
      toast.error(mensagemErroApi(erro, MENSAGEM_ERRO_EXCLUIR));
    },
  });

  return (
    <li className="min-w-0 space-y-2 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-0 font-medium break-words">{meta.representante.nome}</span>
        <Etiqueta>{ROTULO_PERIODO[meta.periodo]}</Etiqueta>
        {gestor && (
          <div className="ml-auto flex print:hidden">
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Editar meta de ${descricao}`}
              className="text-muted-foreground"
              onClick={() => aoEditar(meta)}
            >
              <Pencil aria-hidden="true" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label={`Excluir meta de ${descricao}`}
              className={CLASSES_BOTAO_PERIGO}
              disabled={excluir.isPending}
              onClick={() => excluir.mutate()}
            >
              <Trash2 aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{descreverPeriodo(meta)}</p>
      <BarraProgresso
        rotulo="Visitas"
        real={meta.realizado.visitas}
        alvo={meta.metaVisitas}
        balao={balaoDeVisitas(meta)}
      />
      <BarraProgresso
        rotulo="Vendas"
        real={meta.realizado.vendas}
        alvo={meta.metaVendas}
        moeda
        balao={balaoDeVendas(meta)}
      />
    </li>
  );
}

export function MetasPanel({
  campanha,
  representanteId,
  periodo,
}: {
  campanha?: CampanhaDaMeta;
  representanteId?: string;
  /** O período do Painel: só as metas que cruzam a janela. Sem ele, todas. */
  periodo?: Periodo;
}) {
  const { user } = useAuth();
  const gestor = user?.role === 'GESTOR';
  // O representante recebe só as próprias do backend; o filtro é do gestor
  const { data: metas, isLoading, isError, error } = useMetas({
    campanhaId: campanha?.id,
    representanteId: gestor ? representanteId : undefined,
    periodo,
  });
  // `undefined`: fechado; `null`: meta nova; uma meta: editando
  const [emEdicao, setEmEdicao] = useState<Meta | null | undefined>(undefined);
  const botaoNova = useRef<HTMLButtonElement>(null);
  const gatilho = useRef<HTMLElement | null>(null);
  const devolverFoco = useRef(false);
  const idTitulo = useId();
  const titulo = campanha ? 'Metas da campanha' : 'Metas de visitas e vendas';
  const Titulo = campanha ? 'h3' : 'h2';
  // O representante só lê: no Painel, o bloco encolhe para a largura das metas
  const larguraDasMetas = !gestor && !campanha;

  // Ao fechar o formulário, o foco volta a quem o abriu ou a "Nova meta"
  useEffect(() => {
    if (emEdicao !== undefined || !devolverFoco.current) return;
    devolverFoco.current = false;
    (gatilho.current?.isConnected ? gatilho.current : botaoNova.current)?.focus();
  }, [emEdicao]);

  function abrir(meta: Meta | null): void {
    gatilho.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEmEdicao(meta);
  }

  function fechar(): void {
    devolverFoco.current = true;
    setEmEdicao(undefined);
  }

  return (
    <section
      aria-labelledby={idTitulo}
      className={cn(
        'space-y-3',
        campanha ? 'mt-4 border-t pt-4' : 'rounded-xl border bg-card p-5',
        larguraDasMetas && 'md:w-fit',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Titulo
          id={idTitulo}
          className={cn('flex items-center gap-2 font-semibold', campanha ? 'text-sm' : 'text-base')}
        >
          <Target aria-hidden="true" className="size-4 text-primary" />
          {titulo}
        </Titulo>
        {gestor && emEdicao === undefined && (
          <Button ref={botaoNova} size="sm" variant="outline" className="print:hidden" onClick={() => abrir(null)}>
            <Plus aria-hidden="true" />
            Nova meta
          </Button>
        )}
      </div>

      {gestor && emEdicao !== undefined && (
        <FormularioMeta
          key={emEdicao?.id ?? 'nova'}
          meta={emEdicao}
          campanha={campanha}
          representantePadrao={representanteId}
          aoFechar={fechar}
        />
      )}

      {isLoading && <p className="text-sm text-muted-foreground">Carregando metas...</p>}

      {isError && (
        <Aviso tom="erro" role="alert">
          {mensagemErroApi(error, MENSAGEM_ERRO_CARREGAR)}
        </Aviso>
      )}

      {metas && metas.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {campanha ? 'Nenhuma meta definida para esta campanha.' : 'Nenhuma meta no período escolhido.'}
        </p>
      )}

      {metas && metas.length > 0 && (
        <ul
          aria-labelledby={idTitulo}
          className={cn(
            'grid gap-3',
            // O teto de duas colunas fica na própria grade: dentro de um bloco `w-fit`, o `auto-fit` só conta
            // mais de uma coluna quando a grade tem largura máxima definida (sem ela, fica sempre em uma).
            larguraDasMetas ? 'md:max-w-[40.75rem] md:grid-cols-[repeat(auto-fit,20rem)]' : 'md:grid-cols-2',
          )}
        >
          {metas.map((meta) => (
            <CartaoMeta key={meta.id} meta={meta} gestor={gestor} aoEditar={abrir} />
          ))}
        </ul>
      )}
    </section>
  );
}
