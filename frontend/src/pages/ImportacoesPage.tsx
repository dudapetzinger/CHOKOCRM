/**
 * "Importar notas" do gestor (Etapa 12b): sobe as DANFEs em PDF e traz as
 * vendas reais para o CRM.
 *   - Escolher vários PDFs e "Importar": os arquivos vão um a um, em
 *     sequência (um por requisição), e cada um ganha o seu resultado — notas,
 *     vinculadas, pendentes, ignoradas — ou o seu erro, sem derrubar os
 *     outros;
 *     O resultado de um arquivo lista também os CNPJs das notas sem cliente,
 *     com um link para o bloco abaixo;
 *   - "CNPJs sem cliente no CRM (N)": bloco persistente (`GET /erp/sem-cliente`,
 *     lido como as pendências), um item por CNPJ das notas cujo destinatário
 *     ainda não é cliente — razão social, CNPJ formatado, município, quantas notas. O
 *     gestor cria o cliente pela nota ali mesmo ("Criar cliente",
 *     `CriarClientePelaNota`): escolhe o representante, e o cadastro vem da
 *     DANFE; as notas do CNPJ passam ao cliente novo e o item some. "Copiar
 *     CNPJ" continua, para quem preferir que o representante cadastre (o
 *     cadastro dele também adota as notas do CNPJ e o item some);
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
import { CriarClientePelaNota } from '../components/crm/CriarClientePelaNota';
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
  vincularNota,
  type CnpjSemCliente,
  type Importacao,
  type Nota,
  type VinculoNota,
} from '../services/importacoes';
import { ROTULO_RESULTADO } from '../services/visits';

const MENSAGEM_ERRO_IMPORTAR = 'Não foi possível importar este arquivo.';
const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar a lista.';
/** Âncora do bloco "CNPJs sem cliente no CRM", para o link do resultado da importação. */
const ID_SEM_CLIENTE = 'cnpjs-sem-cliente';

/** Estado do vínculo da nota no histórico, nas palavras do resumo da importação. */
const ROTULO_VINCULO: Record<VinculoNota, string> = {
  AUTOMATICO: 'Vinculada à visita',
  VINCULADA: 'Vinculada à visita',
  PENDENTE: 'Pendente',
  RECUSADA: 'Só no ERP',
  SEM_VISITA: 'Só no ERP',
  SEM_CLIENTE: 'Só no ERP',
};

type ResultadoDoArquivo =
  | { nome: string; estado: 'aguardando' | 'enviando' }
  | { nome: string; estado: 'ok'; importacao: Importacao }
  | { nome: string; estado: 'erro'; mensagem: string };

async function copiarCnpj(cnpj: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(cnpj);
    toast.success('CNPJ copiado');
  } catch {
    toast.error('Não foi possível copiar o CNPJ.');
  }
}

/** Instante ISO (a data/hora da visita) como "dd/mm" no fuso local. */
function diaMes(iso: string): string {
  return formatarData(iso).slice(0, 5);
}

function resumo({ notas, ignoradas }: Importacao): string {
  const vinculadas = notas.filter(({ vinculo }) => vinculo === 'AUTOMATICO' || vinculo === 'VINCULADA').length;
  const pendentes = notas.filter(({ vinculo }) => vinculo === 'PENDENTE').length;
  // Só no ERP: o que não tem vínculo nem espera decisão (recusada, sem visita ou sem cliente).
  const soNoErp = notas.length - vinculadas - pendentes;
  return [
    contar(notas.length, 'nota'),
    contar(vinculadas, 'vinculada'),
    contar(pendentes, 'pendente'),
    ...(soNoErp > 0 ? [`${soNoErp} só no ERP`] : []),
    contar(ignoradas.length, 'ignorada'),
  ].join(' · ');
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
  const entrada = useRef<HTMLInputElement>(null);
  const [arquivos, setArquivos] = useState<File[]>([]);
  const [resultados, setResultados] = useState<ResultadoDoArquivo[]>([]);
  const [importando, setImportando] = useState(false);

  function atualizar(indice: number, resultado: ResultadoDoArquivo) {
    setResultados((atuais) => atuais.map((atual, i) => (i === indice ? resultado : atual)));
  }

  async function importar() {
    const fila = arquivos;
    setImportando(true);
    setResultados(fila.map((arquivo) => ({ nome: arquivo.name, estado: 'aguardando' })));
    for (const [indice, arquivo] of fila.entries()) {
      atualizar(indice, { nome: arquivo.name, estado: 'enviando' });
      try {
        const importacao = await importarPdf(arquivo);
        atualizar(indice, { nome: arquivo.name, estado: 'ok', importacao });
      } catch (erro) {
        atualizar(indice, { nome: arquivo.name, estado: 'erro', mensagem: mensagemErroApi(erro, MENSAGEM_ERRO_IMPORTAR) });
      }
    }
    setImportando(false);
    setArquivos([]);
    if (entrada.current) entrada.current.value = '';
    void queryClient.invalidateQueries({ queryKey: ['erp'] });
  }

  return (
    <div className="space-y-4">
      <Cartao titulo="Importar notas">
        <p className="mb-3 text-sm text-muted-foreground">
          Escolha os PDFs das notas fiscais (DANFE) de venda. Cada arquivo é lido e as vendas entram no CRM.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <div className="max-sm:w-full">
            <label htmlFor="arquivos-de-notas" className="mb-1 block text-sm font-medium">
              Notas fiscais (PDF)
            </label>
            <input
              id="arquivos-de-notas"
              ref={entrada}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              disabled={importando}
              onChange={(evento) => setArquivos(Array.from(evento.target.files ?? []))}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-card file:px-3 file:py-2 file:text-sm"
            />
          </div>
          <Button type="button" onClick={() => void importar()} disabled={importando || arquivos.length === 0} className="max-sm:w-full">
            <FileUp aria-hidden="true" />
            Importar
          </Button>
        </div>

        {resultados.length > 0 && (
          <ul aria-label="Resultado da importação" className="mt-4 divide-y rounded-lg border">
            {resultados.map((resultado, indice) => (
              <li key={`${indice}-${resultado.nome}`} className="px-4 py-3 text-sm">
                <p className="font-medium">{resultado.nome}</p>
                {resultado.estado === 'aguardando' && <p className="text-muted-foreground">Aguardando...</p>}
                {resultado.estado === 'enviando' && <p className="text-muted-foreground">Importando...</p>}
                {resultado.estado === 'ok' && <p>{resumo(resultado.importacao)}</p>}
                {resultado.estado === 'ok' && resultado.importacao.cnpjsSemCliente.length > 0 && (
                  <p className="text-muted-foreground">
                    Sem cliente no CRM:{' '}
                    {resultado.importacao.cnpjsSemCliente
                      .map(({ cnpj, razaoSocial }) => `${razaoSocial} · ${cnpj}`)
                      .join('; ')}
                    .{' '}
                    <a href={`#${ID_SEM_CLIENTE}`} className="font-medium text-primary underline-offset-4 hover:underline">
                      Criar o cliente no bloco "CNPJs sem cliente no CRM"
                    </a>
                  </p>
                )}
                {resultado.estado === 'ok' &&
                  resultado.importacao.ignoradas.map(({ numero, motivo }, i) => (
                    <p key={i} className="text-muted-foreground">
                      Ignoradas: {numero ?? 'sem número'} — {motivo}
                    </p>
                  ))}
                {resultado.estado === 'erro' && (
                  <p role="alert" className="text-st-red-text">
                    {resultado.mensagem}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </Cartao>

      <SemCliente />
      <Pendencias />
      <ImportacoesAnteriores />
    </div>
  );
}

/**
 * CNPJs das notas sem cliente no CRM, com "Criar cliente" e "Copiar CNPJ".
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
          deste CNPJ passam a ser dele; o representante completa e-mail e contatos na ficha. Se preferir que o
          representante cadastre, use "Copiar CNPJ": cadastrado o cliente pelo representante, as notas deste CNPJ
          passam a ser dele e o CNPJ sai desta lista.
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
      <CriarClientePelaNota item={item}>
        <Button type="button" variant="outline" size="sm" onClick={() => void copiarCnpj(item.cnpj)}>
          Copiar CNPJ
        </Button>
      </CriarClientePelaNota>
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
