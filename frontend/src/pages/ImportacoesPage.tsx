/**
 * "Importar notas" do gestor (Etapa 12b): sobe as DANFEs em PDF e traz as
 * vendas reais para o CRM.
 *   - Escolher vários PDFs e "Importar": os arquivos vão um a um, em
 *     sequência (um por requisição), e cada um ganha o seu resultado — notas,
 *     vinculadas, pendentes, ignoradas — ou o seu erro, sem derrubar os
 *     outros;
 *   - "CNPJs sem cliente no CRM": notas cujo destinatário ainda não é
 *     cliente, com "Copiar CNPJ" para passar ao representante da carteira (só ele cadastra cliente);
 *   - "Pendências": notas com uma visita sugerida, à espera de o gestor
 *     vincular ou deixar só no ERP;
 *   - "Importações anteriores": as últimas 20, cada uma com as suas notas e o
 *     estado do vínculo hoje ("Vinculada à visita", "Pendente" ou "Só no
 *     ERP"); a nota vinculada tem "Desvincular" (spec 2.5), a mesma ação do
 *     "Deixar só no ERP" da pendência.
 * As regras valem no backend; as mensagens dele aparecem como vêm.
 * O dia de emissão da nota é data de calendário ('AAAA-MM-DD') e é formatado
 * por texto (`formatarDiaMes`); a data da visita é um instante ISO.
 */
import { useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileUp } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { contar } from '@/lib/contar';
import { useAuth } from '../auth/useAuth';
import { AvisoExclusivoDoGestor } from '../components/AvisoExclusivoDoGestor';
import { Aviso, Cartao } from '../components/crm/ui';
import { useImportacoes, usePendencias } from '../hooks/useImportacoes';
import { formatarData, formatarDiaMes } from '../lib/formatarData';
import { formatarMoeda } from '../lib/formatarMoeda';
import { mensagemErroApi } from '../services/clients';
import {
  desvincularNota,
  importarPdf,
  vincularNota,
  type Importacao,
  type Nota,
  type VinculoNota,
} from '../services/importacoes';
import { ROTULO_RESULTADO } from '../services/visits';

const MENSAGEM_ERRO_IMPORTAR = 'Não foi possível importar este arquivo.';
const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar a lista.';

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

  const semClientes = new Map<string, string>();
  for (const resultado of resultados) {
    if (resultado.estado !== 'ok') continue;
    for (const { cnpj, razaoSocial } of resultado.importacao.cnpjsSemCliente) semClientes.set(cnpj, razaoSocial);
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

      {semClientes.size > 0 && (
        <Cartao titulo="CNPJs sem cliente no CRM">
          <ul className="divide-y">
            {[...semClientes].map(([cnpj, razaoSocial]) => (
              <li key={cnpj} className="flex flex-wrap items-center justify-between gap-3 py-2 text-sm">
                <span>
                  {razaoSocial} <span className="text-muted-foreground">· {cnpj}</span>
                </span>
                <Button type="button" variant="outline" size="sm" onClick={() => void copiarCnpj(cnpj)}>
                  Copiar CNPJ
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            Peça ao representante da carteira para cadastrar o cliente com este CNPJ. As notas passam a aparecer na ficha
            dele na próxima importação.
          </p>
        </Cartao>
      )}

      <Pendencias />
      <ImportacoesAnteriores />
    </div>
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
 * situação) é buscado de novo, e a nota aparece no estado novo sem recarregar.
 */
function useAcoesDaNota(nota: Nota) {
  const queryClient = useQueryClient();
  const aoConcluir = () => queryClient.invalidateQueries({ queryKey: ['erp'] });
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

function LinhaDoHistorico({ nota }: { nota: Nota }) {
  const { desvincular, ocupada } = useAcoesDaNota(nota);
  const vinculada = nota.vinculo === 'VINCULADA' || nota.vinculo === 'AUTOMATICO';

  return (
    <li className="flex flex-wrap items-center justify-between gap-2">
      <span>
        <DescricaoDaNota nota={nota} /> · {ROTULO_VINCULO[nota.vinculo]}
      </span>
      {vinculada && (
        <Button type="button" size="sm" variant="outline" disabled={ocupada} onClick={() => desvincular.mutate()}>
          Desvincular
        </Button>
      )}
    </li>
  );
}
