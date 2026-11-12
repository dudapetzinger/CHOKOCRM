/**
 * "Importar notas" do gestor (Etapa 12b; diálogo na rodada 2026-11-12): sobe
 * as DANFEs em PDF e traz as vendas reais para o CRM. A importação tem três
 * estados:
 *   - Escolher (cartão do topo, sempre na tela): um ou vários PDFs e "Ler
 *     notas", que abre o diálogo "Importar notas" (`Dialogo`). Os arquivos
 *     são lidos um a um, em sequência (`lerPdf`, sem gravar nada), com
 *     "Lendo…" na linha de cada um; o erro de um arquivo fica na linha dele e
 *     não derruba os outros;
 *   - Conferir (`ConferenciaDeNotas`, no diálogo): "Notas lidas (N)", nota a
 *     nota com os produtos, "Sem cliente no CRM · será criado ao concluir" e
 *     "Já importada · será atualizada". "Confirmar importação" reenvia, em
 *     ordem e um por requisição (`importarPdf`, "Importando…"), cada arquivo
 *     que foi lido; "Cancelar" fecha sem gravar. Gravado pelo menos um
 *     arquivo, tudo do ERP (`['erp']`) e a ficha dos clientes (`['client']`)
 *     são buscados de novo e o diálogo passa ao fecho; nenhum, a conferência
 *     fica com o erro de cada arquivo;
 *   - Concluída (`ImportacaoConcluida`, no mesmo diálogo): "Importação
 *     concluída.", o resumo somado (novas × atualizadas, vínculos,
 *     ignoradas), para cada CNPJ sem cliente "Criar cliente para {razão
 *     social} · {CNPJ}" com o formulário (criado o cliente, as notas do CNPJ
 *     passam a ele e aparece "Ver {nomeFantasia}"), "Deseja verificar?" com
 *     "Ver cliente" (ou um "Ver {cliente}" por cliente) até a ficha na aba ERP
 *     e "Nova importação".
 * Fechar o diálogo ("Cancelar", "Nova importação", "Fechar", Esc ou um toque
 * no fundo) volta a "Escolher" limpo, com o foco na escolha de arquivos.
 * Enquanto lê ou grava (`ocupado`), Esc, "Fechar" e o fundo não fecham.
 * Os blocos de baixo ficam sempre na tela:
 *   - "CNPJs sem cliente no CRM (N)": bloco persistente (`GET /erp/sem-cliente`,
 *     lido como as pendências), um item por CNPJ das notas cujo destinatário
 *     ainda não é cliente — razão social, CNPJ formatado, município, quantas notas. O
 *     gestor cria o cliente pela nota ali mesmo ("Criar cliente",
 *     `CriarClientePelaNota`): escolhe o representante, e o cadastro vem da
 *     DANFE; as notas do CNPJ passam ao cliente novo e o item some. Serve às
 *     notas de importações anteriores (as de agora ganham o cliente no fecho);
 *   - "Pendências": notas com uma visita sugerida, à espera de o gestor
 *     vincular ou deixar só no ERP; a linha avisa que os itens do pedido
 *     passam a ser os da nota e, se a visita não é Venda, que ela passa a ser
 *     (spec 2.4);
 *   - "Importações anteriores": as últimas 20, cada uma com as suas notas e o
 *     estado do vínculo hoje ("Vinculada à visita", "Pendente" ou "Só no
 *     ERP"); a nota vinculada tem "Desvincular" (spec 2.5), a mesma ação do
 *     "Deixar só no ERP" da pendência, com confirmação na própria linha
 *     (não tem volta: a nota não é vinculada de novo).
 * As regras valem no backend; as mensagens dele aparecem como vêm.
 * O dia de emissão da nota é data de calendário ('AAAA-MM-DD') e é formatado
 * por texto (`formatarDiaMes`); a data da visita é um instante ISO.
 */
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { contar } from '@/lib/contar';
import { useAuth } from '../auth/useAuth';
import { AvisoExclusivoDoGestor } from '../components/AvisoExclusivoDoGestor';
import { ConferenciaDeNotas, type ArquivoLido } from '../components/crm/ConferenciaDeNotas';
import { CriarClientePelaNota } from '../components/crm/CriarClientePelaNota';
import { Dialogo } from '../components/crm/Dialogo';
import { ImportacaoConcluida, type ArquivoGravado } from '../components/crm/ImportacaoConcluida';
import { Aviso, Cartao } from '../components/crm/ui';
import { useImportacoes, usePendencias, useSemCliente } from '../hooks/useImportacoes';
import { formatarCnpj } from '../lib/formatarCnpj';
import { formatarData, formatarDiaMes } from '../lib/formatarData';
import { formatarMoeda } from '../lib/formatarMoeda';
import { useDevolverFoco } from '../lib/useFoco';
import { mensagemErroApi } from '../services/clients';
import {
  desvincularNota,
  importarPdf,
  lerPdf,
  vincularNota,
  type CnpjSemCliente,
  type Nota,
  type VinculoNota,
} from '../services/importacoes';
import { ROTULO_RESULTADO } from '../services/visits';

const MENSAGEM_ERRO_LER = 'Não foi possível ler este arquivo.';
const MENSAGEM_ERRO_IMPORTAR = 'Não foi possível importar este arquivo.';
const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar a lista.';

/** Âncora do bloco "CNPJs sem cliente no CRM". */
const ID_SEM_CLIENTE = 'cnpjs-sem-cliente';

/** Os três estados do cartão "Importar notas". */
type Etapa = 'escolher' | 'conferir' | 'concluida';

/** O que o fecho mostra: os arquivos gravados e os que falharam ao gravar. */
type Conclusao = { gravados: ArquivoGravado[]; falhas: { nome: string; mensagem: string }[] };

/** Estado do vínculo da nota no histórico, nas palavras do resumo da importação. */
const ROTULO_VINCULO: Record<VinculoNota, string> = {
  AUTOMATICO: 'Vinculada à visita',
  VINCULADA: 'Vinculada à visita',
  PENDENTE: 'Pendente',
  RECUSADA: 'Só no ERP',
  SEM_VISITA: 'Só no ERP',
  SEM_CLIENTE: 'Só no ERP',
};

/** Instante ISO (a data/hora da visita) como "dd/mm" no fuso local. */
function diaMes(iso: string): string {
  return formatarData(iso).slice(0, 5);
}

export function ImportacoesPage() {
  const { user } = useAuth();

  if (user?.role !== 'GESTOR') {
    return <AvisoExclusivoDoGestor />;
  }

  return <Importacoes />;
}

function Importacoes() {
  const queryClient = useQueryClient();
  const [etapa, setEtapa] = useState<Etapa>('escolher');
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [lidos, setLidos] = useState<ArquivoLido[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [concluida, setConcluida] = useState<Conclusao>({ gravados: [], falhas: [] });
  // Trocar a chave recria a entrada de arquivos, vazia, ao recomeçar.
  const [versaoDaEntrada, setVersaoDaEntrada] = useState(0);
  // Fechado o diálogo (Cancelar, Nova importação, Fechar, Esc, fundo), a entrada recebe o foco.
  const { ref: entrada, devolverFoco } = useDevolverFoco<HTMLInputElement>(etapa !== 'escolher');

  function atualizar(indice: number, lido: ArquivoLido) {
    setLidos((atuais) => atuais.map((atual, i) => (i === indice ? lido : atual)));
  }

  /** Lê os PDFs um a um, sem gravar; o erro de um arquivo fica na linha dele. */
  async function lerNotas() {
    const fila = arquivos;
    setOcupado(true);
    setLidos(fila.map((arquivo) => ({ nome: arquivo.name, estado: 'aguardando' })));
    setEtapa('conferir');
    for (const [indice, arquivo] of fila.entries()) {
      atualizar(indice, { nome: arquivo.name, estado: 'lendo' });
      try {
        const leitura = await lerPdf(arquivo);
        atualizar(indice, { nome: arquivo.name, estado: 'lido', leitura });
      } catch (erro) {
        atualizar(indice, { nome: arquivo.name, estado: 'erro', mensagem: mensagemErroApi(erro, MENSAGEM_ERRO_LER) });
      }
    }
    setOcupado(false);
  }

  /**
   * Grava, em ordem, cada arquivo que foi lido (os que falharam na leitura
   * ficam de fora). Gravado pelo menos um, a tela passa ao fecho; nenhum, a
   * conferência fica com o erro na linha de cada arquivo.
   */
  async function confirmar() {
    const fila = lidos.flatMap((lido, indice) => (lido.estado === 'lido' ? [{ lido, indice }] : []));
    setOcupado(true);
    setLidos((atuais) => atuais.map((atual) => (atual.estado === 'lido' ? { ...atual, gravacao: 'aguardando' } : atual)));
    const gravados: ArquivoGravado[] = [];
    const falhas: Conclusao['falhas'] = [];
    for (const { lido, indice } of fila) {
      const arquivo = arquivos[indice];
      atualizar(indice, { ...lido, gravacao: 'importando' });
      try {
        const importacao = await importarPdf(arquivo);
        gravados.push({ leitura: lido.leitura, importacao });
        atualizar(indice, { ...lido, gravacao: 'importada' });
      } catch (erro) {
        const mensagem = mensagemErroApi(erro, MENSAGEM_ERRO_IMPORTAR);
        falhas.push({ nome: lido.nome, mensagem });
        atualizar(indice, { ...lido, gravacao: { erro: mensagem } });
      }
    }
    setOcupado(false);
    if (gravados.length === 0) return;
    // Tudo do ERP (listas de baixo) e a ficha dos clientes (vendas e sugestões), para "Ver cliente" abrir atualizada.
    void queryClient.invalidateQueries({ queryKey: ['erp'] });
    void queryClient.invalidateQueries({ queryKey: ['client'] });
    setConcluida({ gravados, falhas });
    setEtapa('concluida');
  }

  /** Fechar o diálogo, de qualquer jeito: tela limpa, pronta para os próximos PDFs. */
  function recomecar() {
    devolverFoco();
    setVersaoDaEntrada((versao) => versao + 1);
    setArquivos([]);
    setLidos([]);
    setConcluida({ gravados: [], falhas: [] });
    setEtapa('escolher');
  }

  return (
    <div className="space-y-4">
      <Cartao titulo="Importar notas">
        <p className="mb-3 text-sm text-muted-foreground">
          Escolha os PDFs das notas fiscais (DANFE) de venda. As notas são lidas para você conferir antes de entrarem no
          CRM.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="max-sm:w-full">
            <label htmlFor="arquivos-de-notas" className="mb-1 block text-sm font-medium">
              Notas fiscais (PDF)
            </label>
            <input
              key={versaoDaEntrada}
              id="arquivos-de-notas"
              ref={entrada}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              onChange={(evento) => setArquivos(Array.from(evento.target.files ?? []))}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-card file:px-3 file:py-2 file:text-sm"
            />
          </div>
          <Button
            type="button"
            onClick={() => void lerNotas()}
            disabled={arquivos.length === 0 || etapa !== 'escolher'}
            className="max-sm:w-full"
          >
            <FileUp aria-hidden="true" />
            Ler notas
          </Button>
        </div>
      </Cartao>

      <Dialogo titulo="Importar notas" aberto={etapa !== 'escolher'} aoFechar={recomecar} bloqueado={ocupado}>
        {etapa === 'conferir' && (
          <ConferenciaDeNotas
            arquivos={lidos}
            ocupado={ocupado}
            aoConfirmar={() => void confirmar()}
            aoCancelar={recomecar}
          />
        )}
        {etapa === 'concluida' && (
          <ImportacaoConcluida gravados={concluida.gravados} falhas={concluida.falhas} aoNovaImportacao={recomecar} />
        )}
      </Dialogo>

      <SemCliente />
      <Pendencias />
      <ImportacoesAnteriores />
    </div>
  );
}

/**
 * CNPJs das notas sem cliente no CRM, com "Criar cliente".
 * Sem nenhum, o bloco não aparece; criado o cliente, a lista é buscada de
 * novo (`['erp']`) e o item some.
 */
function SemCliente() {
  const { data: itens, isError, error } = useSemCliente();

  if (isError) {
    return (
      <Cartao titulo="CNPJs sem cliente no CRM">
        <Aviso tom="erro" role="alert">
          {mensagemErroApi(error, MENSAGEM_ERRO_CARREGAR)}
        </Aviso>
      </Cartao>
    );
  }
  if (!itens || itens.length === 0) return null;

  return (
    <div id={ID_SEM_CLIENTE} className="scroll-mt-4">
      <Cartao titulo={`CNPJs sem cliente no CRM (${itens.length})`}>
        <ul aria-label="CNPJs sem cliente no CRM" className="divide-y">
          {itens.map((item) => (
            <ItemSemCliente key={item.cnpj} item={item} />
          ))}
        </ul>
        <p className="mt-3 text-sm text-muted-foreground">
          "Criar cliente" cadastra o cliente com os dados da nota, na carteira do representante escolhido, e as notas
          deste CNPJ passam a ser dele; o representante completa e-mail e contatos na ficha.
        </p>
      </Cartao>
    </div>
  );
}

function ItemSemCliente({ item }: { item: CnpjSemCliente }) {
  const local = item.municipio ? (item.uf ? `${item.municipio}/${item.uf}` : item.municipio) : null;

  return (
    <li className="space-y-2 py-3 text-sm">
      <p>
        <b className="font-medium">{item.razaoSocial}</b>
        <br />
        <span className="text-muted-foreground">
          {[formatarCnpj(item.cnpj), local, contar(item.notas, 'nota')].filter(Boolean).join(' · ')}
        </span>
      </p>
      <CriarClientePelaNota item={item} />
    </li>
  );
}

function Pendencias() {
  const { data: pendencias, isLoading, isError, error } = usePendencias();

  return (
    <Cartao titulo={pendencias ? `Pendências (${pendencias.length})` : 'Pendências'}>
      {isLoading && <p className="text-sm text-muted-foreground">Carregando pendências...</p>}
      {isError && (
        <Aviso tom="erro" role="alert">
          {mensagemErroApi(error, MENSAGEM_ERRO_CARREGAR)}
        </Aviso>
      )}
      {pendencias?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma pendência.</p>}
      {pendencias && pendencias.length > 0 && (
        <ul aria-label="Notas pendentes" className="divide-y">
          {pendencias.map((nota) => (
            <LinhaPendente key={nota.id} nota={nota} />
          ))}
        </ul>
      )}
    </Cartao>
  );
}

/**
 * Vincular e desvincular uma nota, usados pela pendência e pelo histórico.
 * Depois de qualquer um, tudo do ERP (`['erp']`: importações, pendências,
 * situação) é buscado de novo, e a nota aparece no estado novo sem recarregar;
 * a ficha dos clientes (`['client']`: vendas do ERP e visitas, cujos itens e
 * resultado mudaram) também.
 */
function useAcoesDaNota(nota: Nota) {
  const queryClient = useQueryClient();
  const aoConcluir = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['erp'] }),
      queryClient.invalidateQueries({ queryKey: ['client'] }),
    ]);
  const aoFalhar = (erro: unknown) => toast.error(mensagemErroApi(erro, 'Não foi possível salvar. Tente novamente.'));

  const vincular = useMutation({
    mutationFn: (visitId: string) => vincularNota(nota.id, visitId),
    onSuccess: aoConcluir,
    onError: aoFalhar,
  });
  const desvincular = useMutation({
    mutationFn: () => desvincularNota(nota.id),
    onSuccess: aoConcluir,
    onError: aoFalhar,
  });
  return { vincular, desvincular, ocupada: vincular.isPending || desvincular.isPending };
}

/** "Doceria Central — nota 2455 de 04/11 · R$ 1.000,00", comum à pendência e ao histórico. */
function DescricaoDaNota({ nota }: { nota: Nota }) {
  return (
    <>
      <b className="font-medium">{nota.cliente?.nomeFantasia ?? nota.destinatarioNome}</b> — nota {nota.numero} de{' '}
      {formatarDiaMes(nota.dataEmissao)} · {formatarMoeda(nota.valorTotal)}
    </>
  );
}

function LinhaPendente({ nota }: { nota: Nota }) {
  const { vincular, desvincular, ocupada } = useAcoesDaNota(nota);
  const visita = nota.visitaSugerida;

  return (
    <li className="space-y-2 py-3 text-sm">
      <p>
        <DescricaoDaNota nota={nota} />
        {visita?.totalPedido != null && ` · Pedido da visita: ${formatarMoeda(visita.totalPedido)}`}
      </p>
      <div className="flex flex-wrap gap-2">
        {visita && (
          <Button type="button" size="sm" disabled={ocupada} onClick={() => vincular.mutate(visita.id)}>
            {`Vincular à visita de ${diaMes(visita.dataHora)}${visita.resultado ? ` (${ROTULO_RESULTADO[visita.resultado]})` : ''}`}
          </Button>
        )}
        <Button type="button" size="sm" variant="outline" disabled={ocupada} onClick={() => desvincular.mutate()}>
          Deixar só no ERP
        </Button>
      </div>
      {visita && (
        <p className="text-muted-foreground">
          {visita.resultado !== 'VENDA' &&
            `A visita de ${diaMes(visita.dataHora)}${visita.resultado ? ` (${ROTULO_RESULTADO[visita.resultado]})` : ''} passa a contar como Venda. `}
          Os itens do pedido passam a ser os da nota.
        </p>
      )}
    </li>
  );
}

function ImportacoesAnteriores() {
  const { data: importacoes, isLoading, isError, error } = useImportacoes();

  return (
    <Cartao titulo="Importações anteriores">
      {isLoading && <p className="text-sm text-muted-foreground">Carregando importações...</p>}
      {isError && (
        <Aviso tom="erro" role="alert">
          {mensagemErroApi(error, MENSAGEM_ERRO_CARREGAR)}
        </Aviso>
      )}
      {importacoes?.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma importação ainda.</p>}
      {importacoes && importacoes.length > 0 && (
        <ul aria-label="Importações anteriores" className="divide-y">
          {importacoes.map((importacao) => (
            <li key={importacao.id} className="py-2 text-sm">
              {importacao.nomeArquivo} — {contar(importacao.notas.length, 'nota')} · {formatarData(importacao.criadoEm)} ·{' '}
              {importacao.autor.nome}
              {importacao.notas.length > 0 && (
                <ul aria-label="Notas da importação" className="mt-1.5 space-y-1.5 pl-3 text-muted-foreground">
                  {importacao.notas.map((nota) => (
                    <LinhaDoHistorico key={nota.id} nota={nota} />
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

/**
 * Nota do histórico. "Desvincular" não tem volta (a nota não é vinculada de
 * novo), então pede confirmação na própria linha: o foco vai para
 * "Confirmar" ao abrir e volta ao botão em "Cancelar".
 */
function LinhaDoHistorico({ nota }: { nota: Nota }) {
  const { desvincular, ocupada } = useAcoesDaNota(nota);
  const vinculada = nota.vinculo === 'VINCULADA' || nota.vinculo === 'AUTOMATICO';
  const [confirmando, setConfirmando] = useState(false);
  const { ref: botaoDesvincular, devolverFoco } = useDevolverFoco<HTMLButtonElement>(confirmando);
  const botaoConfirmar = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (confirmando) botaoConfirmar.current?.focus();
  }, [confirmando]);

  return (
    <li className="flex flex-wrap items-center justify-between gap-2">
      <span>
        <DescricaoDaNota nota={nota} /> · {ROTULO_VINCULO[nota.vinculo]}
      </span>
      {vinculada && !confirmando && (
        <Button
          ref={botaoDesvincular}
          type="button"
          size="sm"
          variant="outline"
          disabled={ocupada}
          onClick={() => setConfirmando(true)}
        >
          Desvincular
        </Button>
      )}
      {vinculada && confirmando && (
        <div className="flex flex-wrap items-center gap-2 text-foreground">
          <span>
            Desvincular a nota {nota.numero}? Os itens da visita ficam vazios e a nota não volta a ser vinculada.
          </span>
          <Button
            ref={botaoConfirmar}
            type="button"
            size="sm"
            variant="destructive"
            disabled={ocupada}
            onClick={() => desvincular.mutate(undefined, { onSuccess: () => setConfirmando(false) })}
          >
            Confirmar
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={ocupada}
            onClick={() => {
              devolverFoco();
              setConfirmando(false);
            }}
          >
            Cancelar
          </Button>
        </div>
      )}
    </li>
  );
}
