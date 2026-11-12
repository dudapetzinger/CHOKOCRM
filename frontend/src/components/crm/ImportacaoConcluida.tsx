/**
 * Fecho da importação de notas, dentro do diálogo da página "Importar notas":
 * "Importação concluída." (título que recebe o foco ao aparecer), o resumo
 * somado de todos os arquivos gravados, para cada CNPJ das notas gravadas
 * sem cliente no CRM um bloco "Criar cliente para {razão social} · {CNPJ}"
 * com o formulário de `CriarClientePelaNota` já aberto (representante,
 * nome fantasia e recorrência), e "Deseja verificar?" com o caminho até as
 * notas:
 *   - todas as notas de um só cliente → "Ver cliente";
 *   - notas de vários clientes (ou de um cliente e outras sem cliente) → um
 *     "Ver {nomeFantasia}" por cliente;
 * e "Nova importação", que devolve a tela ao início.
 * Criado o cliente de um CNPJ (o backend passa as notas do CNPJ a ele), o
 * formulário dá lugar ao link "Ver {nomeFantasia}" até a ficha na aba ERP,
 * que recebe o foco; os clientes criados ficam em estado local (o resumo não
 * muda). Os CNPJs vêm das notas gravadas com `cliente === null`, agrupados
 * por `destinatarioCnpj`, com o `destinatarioNome` como razão social.
 * Resumo: `N notas novas · M atualizadas · vinculadas · pendentes · só no ERP
 * · ignoradas`, sem as partes zeradas. Nova × atualizada vem da leitura
 * (`jaImportada`), casada com a nota gravada pela chave de acesso; a mesma
 * nota em dois arquivos conta uma vez. Arquivos que falharam ao gravar
 * aparecem com o erro.
 */
import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { contar } from '@/lib/contar';
import { formatarCnpj } from '../../lib/formatarCnpj';
import type { Importacao, Leitura, Nota } from '../../services/importacoes';
import { CriarClientePelaNota, type ClienteCriado } from './CriarClientePelaNota';

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

/** Os CNPJs das notas gravadas sem cliente, um por CNPJ, na ordem em que aparecem. */
function cnpjsSemCliente(notas: Nota[]): { cnpj: string; razaoSocial: string }[] {
  const porCnpj = new Map<string, { cnpj: string; razaoSocial: string }>();
  for (const nota of notas) {
    if (nota.cliente === null && !porCnpj.has(nota.destinatarioCnpj)) {
      porCnpj.set(nota.destinatarioCnpj, { cnpj: nota.destinatarioCnpj, razaoSocial: nota.destinatarioNome });
    }
  }
  return [...porCnpj.values()];
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
  // Clientes criados aqui, por CNPJ: o formulário do CNPJ dá lugar ao link para a ficha.
  const [criados, setCriados] = useState<Map<string, ClienteCriado>>(() => new Map());

  const notas = notasGravadas(gravados);
  const clientes = [...new Map(notas.flatMap(({ cliente }) => (cliente ? [[cliente.id, cliente] as const] : []))).values()];
  const algumaSemCliente = notas.some(({ cliente }) => cliente === null);
  const umSoCliente = clientes.length === 1 && !algumaSemCliente;
  const semCliente = cnpjsSemCliente(notas);
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
        <ul aria-label="Clientes a criar" className="space-y-3">
          {semCliente.map((item) => (
            <ClienteACriar
              key={item.cnpj}
              item={item}
              criado={criados.get(item.cnpj)}
              aoCriar={(cliente) => setCriados((atuais) => new Map(atuais).set(item.cnpj, cliente))}
            />
          ))}
        </ul>
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

/** "Criar cliente para {razão social} · {CNPJ}" com o formulário; criado o cliente, "Ver {nomeFantasia}". */
function ClienteACriar({
  item,
  criado,
  aoCriar,
}: {
  item: { cnpj: string; razaoSocial: string };
  criado: ClienteCriado | undefined;
  aoCriar: (cliente: ClienteCriado) => void;
}) {
  const idRotulo = useId();

  return (
    <li>
      <div role="group" aria-labelledby={idRotulo} className="space-y-2 rounded-lg border p-3">
        <p id={idRotulo} className="font-medium">
          {`Criar cliente para ${item.razaoSocial} · ${formatarCnpj(item.cnpj)}`}
        </p>
        {criado ? (
          <VerClienteCriado cliente={criado} />
        ) : (
          <CriarClientePelaNota item={item} abertoDeInicio aoCriar={aoCriar} />
        )}
      </div>
    </li>
  );
}

/** O link para a ficha do cliente recém-criado; recebe o foco, que estava no formulário que saiu. */
function VerClienteCriado({ cliente }: { cliente: ClienteCriado }) {
  const link = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    link.current?.focus();
  }, []);

  return (
    <Button variant="outline" asChild>
      <Link ref={link} to={`/clientes/${cliente.id}?aba=erp`}>{`Ver ${cliente.nomeFantasia}`}</Link>
    </Button>
  );
}
