/**
 * Conferência da importação de notas, dentro do diálogo da página "Importar
 * notas": o que foi lido de cada PDF, antes de gravar. Um item por arquivo, na ordem escolhida, com o andamento
 * ("Aguardando…", "Lendo…", "Importando…"), o erro de leitura (ou de
 * gravação) na linha do próprio arquivo e, lido o arquivo, as notas: número,
 * emissão e valor, destinatário (nome e CNPJ), "Cliente: …" ou "Sem cliente
 * no CRM · será criado ao concluir" (só informativo: o fecho oferece criar o
 * cliente do CNPJ), "Já importada · será atualizada" quando a chave de acesso já
 * existe, e todos os produtos (sem recolher: é a conferência). As ignoradas
 * aparecem com o motivo.
 * "Confirmar importação" só se habilita quando algum arquivo lido tem nota;
 * "Cancelar" volta ao início. Os dois ficam desabilitados enquanto a página
 * lê ou grava (`ocupado`). Ao aparecer, o foco vai para o título "Notas
 * lidas (N)"; o andamento de cada arquivo fica numa região
 * `aria-live="polite"`. Quem lê e grava é a página: aqui só se mostra.
 */
import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { formatarCnpj } from '../../lib/formatarCnpj';
import { formatarDataCalendario } from '../../lib/formatarData';
import { formatarMoeda } from '../../lib/formatarMoeda';
import type { Leitura, NotaLida } from '../../services/importacoes';

/** Andamento da gravação de um arquivo já lido, depois de "Confirmar importação". */
export type GravacaoDoArquivo = 'aguardando' | 'importando' | 'importada' | { erro: string };

export type ArquivoLido =
  | { nome: string; estado: 'aguardando' | 'lendo' }
  | { nome: string; estado: 'lido'; leitura: Leitura; gravacao?: GravacaoDoArquivo }
  | { nome: string; estado: 'erro'; mensagem: string };

/** Há o que confirmar: algum arquivo lido com pelo menos uma nota. */
function temNotaParaConfirmar(arquivos: ArquivoLido[]): boolean {
  return arquivos.some((arquivo) => arquivo.estado === 'lido' && arquivo.leitura.notas.length > 0);
}

export function ConferenciaDeNotas({
  arquivos,
  ocupado,
  aoConfirmar,
  aoCancelar,
}: {
  arquivos: ArquivoLido[];
  ocupado: boolean;
  aoConfirmar: () => void;
  aoCancelar: () => void;
}) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titulo.current?.focus();
  }, []);
  const total = arquivos.reduce((soma, arquivo) => soma + (arquivo.estado === 'lido' ? arquivo.leitura.notas.length : 0), 0);

  return (
    <div className="space-y-3">
      <h3 ref={titulo} tabIndex={-1} className="text-sm font-semibold outline-none">{`Notas lidas (${total})`}</h3>
      <ul aria-label="Arquivos lidos" className="divide-y rounded-lg border">
        {arquivos.map((arquivo, indice) => (
          <li key={`${indice}-${arquivo.nome}`} className="space-y-2 px-4 py-3 text-sm">
            <p className="font-medium">{arquivo.nome}</p>
            <div aria-live="polite">
              <Andamento arquivo={arquivo} />
            </div>
            {arquivo.estado === 'lido' && <NotasDoArquivo leitura={arquivo.leitura} />}
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={aoConfirmar} disabled={ocupado || !temNotaParaConfirmar(arquivos)}>
          Confirmar importação
        </Button>
        <Button type="button" variant="outline" onClick={aoCancelar} disabled={ocupado}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}

function Andamento({ arquivo }: { arquivo: ArquivoLido }) {
  if (arquivo.estado === 'erro') {
    return (
      <p role="alert" className="text-st-red-text">
        {arquivo.mensagem}
      </p>
    );
  }
  if (arquivo.estado !== 'lido') {
    return <p className="text-muted-foreground">{arquivo.estado === 'lendo' ? 'Lendo…' : 'Aguardando…'}</p>;
  }
  const { gravacao } = arquivo;
  if (gravacao === 'aguardando') return <p className="text-muted-foreground">Aguardando…</p>;
  if (gravacao === 'importando') return <p className="text-muted-foreground">Importando…</p>;
  if (gravacao === 'importada') return <p className="text-muted-foreground">Importada.</p>;
  if (gravacao) {
    return (
      <p role="alert" className="text-st-red-text">
        {gravacao.erro}
      </p>
    );
  }
  return null;
}

function NotasDoArquivo({ leitura }: { leitura: Leitura }) {
  if (leitura.notas.length === 0 && leitura.ignoradas.length === 0) {
    return <p className="text-muted-foreground">Nenhuma nota neste arquivo.</p>;
  }
  return (
    <>
      {leitura.notas.length > 0 && (
        <ul aria-label="Notas do arquivo" className="space-y-3">
          {leitura.notas.map((nota) => (
            <NotaConferida key={nota.chaveAcesso} nota={nota} />
          ))}
        </ul>
      )}
      {leitura.ignoradas.map(({ numero, motivo }, i) => (
        <p key={i} className="text-muted-foreground">
          Ignoradas: {numero ?? 'sem número'} — {motivo}
        </p>
      ))}
    </>
  );
}

function NotaConferida({ nota }: { nota: NotaLida }) {
  return (
    <li aria-label={`NF ${nota.numero}`} className="space-y-1 rounded-md bg-muted/40 px-3 py-2">
      <p className="font-medium">
        NF {nota.numero} · {formatarDataCalendario(nota.dataEmissao)} · {formatarMoeda(nota.valorTotal)}
      </p>
      <p className="text-muted-foreground">
        {nota.destinatarioNome} · {formatarCnpj(nota.destinatarioCnpj)}
      </p>
      <p>{nota.cliente ? `Cliente: ${nota.cliente.nomeFantasia}` : 'Sem cliente no CRM · será criado ao concluir'}</p>
      {nota.jaImportada && <p className="w-fit rounded bg-st-yellow-soft px-1.5 font-medium">Já importada · será atualizada</p>}
      {nota.itens.length > 0 && (
        <ul aria-label={`Produtos da NF ${nota.numero}`} className="list-disc space-y-0.5 pl-5">
          {nota.itens.map((item, i) => (
            <li key={`${i}-${item.codigo}`}>
              {`${item.quantidade.toLocaleString('pt-BR')} × ${item.descricao} · ${formatarMoeda(item.precoUnitario)}`}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
