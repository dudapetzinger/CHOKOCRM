/**
 * Fecho da importação de notas: "Importação concluída." (título que recebe o
 * foco ao aparecer), o resumo somado de todos os arquivos gravados e
 * "Deseja verificar?" com o caminho até as notas:
 *   - todas as notas de um só cliente → "Ver cliente";
 *   - notas de vários clientes (ou de um cliente e outras sem cliente) → um
 *     "Ver {nomeFantasia}" por cliente;
 *   - notas sem cliente → os CNPJs e o link para o bloco "CNPJs sem cliente
 *     no CRM", onde o gestor cria o cliente;
 * e "Nova importação", que devolve a tela ao início.
 * Resumo: `N notas novas · M atualizadas · vinculadas · pendentes · só no ERP
 * · ignoradas`, sem as partes zeradas. Nova × atualizada vem da leitura
 * (`jaImportada`), casada com a nota gravada pela chave de acesso; a mesma
 * nota em dois arquivos conta uma vez. Arquivos que falharam ao gravar
 * aparecem com o erro.
 */
import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { contar } from '@/lib/contar';
import { formatarCnpj } from '../../lib/formatarCnpj';
import type { Importacao, Leitura, Nota } from '../../services/importacoes';

/** Âncora do bloco "CNPJs sem cliente no CRM" na página de importação. */
export const ID_SEM_CLIENTE = 'cnpjs-sem-cliente';

/** Um arquivo gravado: o que a conferência leu dele e o que a gravação devolveu. */
export type ArquivoGravado = { leitura: Leitura; importacao: Importacao };

/** As notas gravadas sem repetição (pela chave de acesso; vale a última gravação). */
function notasGravadas(gravados: ArquivoGravado[]): Nota[] {
  const porChave = new Map<string, Nota>();
  for (const { importacao } of gravados) {
    for (const nota of importacao.notas) porChave.set(nota.chaveAcesso, nota);
  }
  return [...porChave.values()];
}

function resumo(gravados: ArquivoGravado[], notas: Nota[]): string {
  const jaImportadas = new Set(
    gravados.flatMap(({ leitura }) => leitura.notas.filter((nota) => nota.jaImportada).map((nota) => nota.chaveAcesso)),
  );
  const atualizadas = notas.filter((nota) => jaImportadas.has(nota.chaveAcesso)).length;
  const novas = notas.length - atualizadas;
  const vinculadas = notas.filter(({ vinculo }) => vinculo === 'AUTOMATICO' || vinculo === 'VINCULADA').length;
  const pendentes = notas.filter(({ vinculo }) => vinculo === 'PENDENTE').length;
  // Só no ERP: o que não tem vínculo nem espera decisão (recusada, sem visita ou sem cliente).
  const soNoErp = notas.length - vinculadas - pendentes;
  const ignoradas = gravados.reduce((soma, { importacao }) => soma + importacao.ignoradas.length, 0);
  const partes = [
    novas > 0 ? contar(novas, 'nota nova', 'notas novas') : null,
    atualizadas > 0 ? contar(atualizadas, 'atualizada') : null,
    vinculadas > 0 ? contar(vinculadas, 'vinculada') : null,
    pendentes > 0 ? contar(pendentes, 'pendente') : null,
    soNoErp > 0 ? `${soNoErp} só no ERP` : null,
    ignoradas > 0 ? contar(ignoradas, 'ignorada') : null,
  ].filter((parte): parte is string => parte !== null);
  return partes.length > 0 ? partes.join(' · ') : '0 notas';
}

export function ImportacaoConcluida({
  gravados,
  falhas,
  aoNovaImportacao,
}: {
  gravados: ArquivoGravado[];
  falhas: { nome: string; mensagem: string }[];
  aoNovaImportacao: () => void;
}) {
  const titulo = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    titulo.current?.focus();
  }, []);

  const notas = notasGravadas(gravados);
  const clientes = [...new Map(notas.flatMap(({ cliente }) => (cliente ? [[cliente.id, cliente] as const] : []))).values()];
  const algumaSemCliente = notas.some(({ cliente }) => cliente === null);
  const umSoCliente = clientes.length === 1 && !algumaSemCliente;
  const semCliente = [
    ...new Map(gravados.flatMap(({ importacao }) => importacao.cnpjsSemCliente.map((item) => [item.cnpj, item] as const))).values(),
  ];
  const ignoradas = gravados.flatMap(({ importacao }) => importacao.ignoradas);

  return (
    <div className="space-y-3 text-sm">
      <h3 ref={titulo} tabIndex={-1} className="text-base font-semibold outline-none">
        Importação concluída.
      </h3>
      <p>{resumo(gravados, notas)}</p>
      {ignoradas.map(({ numero, motivo }, i) => (
        <p key={i} className="text-muted-foreground">
          Ignoradas: {numero ?? 'sem número'} — {motivo}
        </p>
      ))}
      {falhas.map(({ nome, mensagem }, indice) => (
        <p key={`${indice}-${nome}`} role="alert" className="text-st-red-text">
          {nome}: {mensagem}
        </p>
      ))}
      {semCliente.length > 0 && (
        <p className="text-muted-foreground">
          Sem cliente no CRM:{' '}
          {semCliente.map(({ cnpj, razaoSocial }) => `${razaoSocial} · ${formatarCnpj(cnpj)}`).join('; ')}.{' '}
          <a href={`#${ID_SEM_CLIENTE}`} className="font-medium text-primary underline-offset-4 hover:underline">
            Criar o cliente no bloco "CNPJs sem cliente no CRM"
          </a>
        </p>
      )}
      <p className="font-medium">Deseja verificar?</p>
      <div className="flex flex-wrap gap-2">
        {umSoCliente ? (
          <Button asChild>
            <Link to={`/clientes/${clientes[0].id}?aba=erp`}>Ver cliente</Link>
          </Button>
        ) : (
          clientes.map((cliente) => (
            <Button key={cliente.id} variant="outline" asChild>
              <Link to={`/clientes/${cliente.id}?aba=erp`}>{`Ver ${cliente.nomeFantasia}`}</Link>
            </Button>
          ))
        )}
        <Button type="button" variant={clientes.length > 0 ? 'outline' : 'default'} onClick={aoNovaImportacao}>
          Nova importação
        </Button>
      </div>
    </div>
  );
}
