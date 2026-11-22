/**
 * Filtro de período de análise dos indicadores do Painel:
 * controle segmentado "Este mês · 30 · 90 · 365 dias · Personalizado" que
 * escolhe a janela que os indicadores consideram. "Este mês" vai do dia 1º
 * até hoje. Controlado: quem usa guarda o valor
 * (`useState<Periodo>(PERIODO_PADRAO)`).
 *
 * "Personalizado" mostra "De" e "Até" (datas até hoje), já preenchidos com a
 * janela que estava marcada (30 dias: de hoje-29 a hoje; este mês: do dia 1º
 * a hoje). `onChange` só é
 * chamado com uma faixa válida: início e fim preenchidos, `De ≤ Até ≤ hoje` e
 * no máximo 365 dias. Acima disso o Painel não mostra: a mensagem do limite
 * aparece (`role="status"`) e `onPeriodoDaPlanilha` recebe a faixa, porque a
 * Planilha aceita qualquer tamanho. Numa edição inválida (data vazia, depois
 * de hoje, fim antes do início), `onPeriodoDaPlanilha` recebe o `valor` (o
 * período que o Painel está mostrando), para a Planilha não ficar presa numa
 * faixa acima do limite digitada antes. Os erros ficam junto do campo, na ordem:
 * data vazia ("Informe as duas datas.", só depois de a pessoa editar), data
 * depois de hoje e fim antes do início. No celular os quatro períodos fixos
 * dividem a linha de cima do segmentado e "Personalizado" ocupa a de baixo;
 * os dois campos de data ficam lado a lado, abaixo do segmentado.
 */
import { useId, useState } from 'react';
import { cn } from '@/lib/utils';
import { hojeEmSaoPaulo } from '../lib/calendario';
import {
  chaveDoPeriodo,
  diasDaFaixa,
  ehMesAtual,
  ehPersonalizado,
  faixaDoMesAtual,
  LIMITE_DIAS_DO_PAINEL,
  MENSAGEM_LIMITE_DO_PAINEL,
  type Periodo,
} from '../lib/periodo';
import { Campo } from './crm/ui';
import { FiltroPilulas } from './FiltroPilulas';
import { Input } from './ui/input';

const MES_ATUAL = 'MES_ATUAL';
const PERSONALIZADO = 'PERSONALIZADO';
type ValorDaOpcao = typeof MES_ATUAL | 30 | 90 | 365 | typeof PERSONALIZADO;
const OPCOES_PERIODO: { valor: ValorDaOpcao; rotulo: string }[] = [
  { valor: MES_ATUAL, rotulo: 'Este mês' },
  { valor: 30, rotulo: '30 dias' },
  { valor: 90, rotulo: '90 dias' },
  { valor: 365, rotulo: '365 dias' },
  { valor: PERSONALIZADO, rotulo: 'Personalizado' },
];
const MENSAGEM_FIM_ANTES_DO_INICIO = 'A data de fim deve ser depois do início.';
const MENSAGEM_DEPOIS_DE_HOJE = 'A data não pode ser depois de hoje.';
const MENSAGEM_DATA_VAZIA = 'Informe as duas datas.';

type Props = {
  valor: Periodo;
  onChange: (periodo: Periodo) => void;
  /** Recebe a faixa que passou do limite do Painel, para a Planilha usá-la (ou o `valor`, numa edição inválida). */
  onPeriodoDaPlanilha?: (periodo: Periodo) => void;
  /** Regra de layout do `FiltroPilulas` (padrão: respiro embaixo). */
  className?: string;
};

type Datas = { de: string; ate: string };

function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(ano, mes - 1, dia + dias)).toISOString().slice(0, 10);
}

/** A janela marcada como datas: do dia 1º a hoje, de hoje-(dias-1) a hoje, ou a própria faixa. */
function datasDaJanela(valor: Periodo, hoje: string): Datas {
  if (ehPersonalizado(valor)) return { de: valor.inicio, ate: valor.fim };
  if (ehMesAtual(valor)) {
    const { inicio, fim } = faixaDoMesAtual(hoje);
    return { de: inicio, ate: fim };
  }
  return { de: somarDias(hoje, 1 - valor.dias), ate: hoje };
}

/** A opção marcada no segmentado para um período fechado (sem "Personalizado" aberto). */
function opcaoDoPeriodo(valor: Periodo): ValorDaOpcao {
  if (ehPersonalizado(valor)) return PERSONALIZADO;
  return ehMesAtual(valor) ? MES_ATUAL : valor.dias;
}

/**
 * O erro de cada campo, na ordem: vazio, depois de hoje, fim antes do início.
 * O de "fim antes do início" só vem quando as duas datas são válidas por si.
 */
function errosDasDatas({ de, ate }: Datas, hoje: string, editou: boolean): { de?: string; ate?: string } {
  const erros: { de?: string; ate?: string } = {};
  if (editou && de === '') erros.de = MENSAGEM_DATA_VAZIA;
  else if (de > hoje) erros.de = MENSAGEM_DEPOIS_DE_HOJE;
  if (editou && ate === '') erros.ate = MENSAGEM_DATA_VAZIA;
  else if (ate > hoje) erros.ate = MENSAGEM_DEPOIS_DE_HOJE;
  if (de !== '' && ate !== '' && !erros.de && !erros.ate && ate < de) erros.ate = MENSAGEM_FIM_ANTES_DO_INICIO;
  return erros;
}

export function FiltroPeriodo({ valor, onChange, onPeriodoDaPlanilha, className = 'mb-4' }: Props) {
  const idDe = useId();
  const idAte = useId();
  const hoje = hojeEmSaoPaulo();
  // `null`: o segmentado segue o `valor`; com datas: "Personalizado" aberto, ainda que a faixa esteja incompleta ou inválida.
  const [rascunho, setRascunho] = useState<Datas | null>(null);
  const datas = rascunho ?? (ehPersonalizado(valor) ? datasDaJanela(valor, hoje) : null);
  // "Informe as duas datas." só depois de a pessoa mexer: ao abrir, os campos já vêm preenchidos.
  const [editou, setEditou] = useState(false);
  // `valor` trocado por fora (outro período no Painel): o rascunho e o "editou" recomeçam, para o filtro
  // seguir o período novo sem o aviso de uma edição antiga.
  const chave = chaveDoPeriodo(valor);
  const [chaveAnterior, setChaveAnterior] = useState(chave);
  if (chave !== chaveAnterior) {
    setChaveAnterior(chave);
    setRascunho(null);
    setEditou(false);
  }
  const erros = datas ? errosDasDatas(datas, hoje, editou) : { de: undefined, ate: undefined };
  const acimaDoLimite =
    datas !== null &&
    !erros.de &&
    !erros.ate &&
    datas.de !== '' &&
    datas.ate !== '' &&
    diasDaFaixa(datas.de, datas.ate) > LIMITE_DIAS_DO_PAINEL;

  function escolher(opcao: ValorDaOpcao): void {
    if (opcao === PERSONALIZADO) {
      if (datas === null) setRascunho(datasDaJanela(valor, hoje));
      return;
    }
    setRascunho(null);
    setEditou(false);
    onChange(opcao === MES_ATUAL ? { mes: 'ATUAL' } : { dias: opcao });
  }

  function editar(proximas: Datas): void {
    setRascunho(proximas);
    setEditou(true);
    const { de, ate } = proximas;
    if (!de || !ate || de > ate || ate > hoje) {
      onPeriodoDaPlanilha?.(valor);
      return;
    }
    const faixa = { inicio: de, fim: ate };
    if (diasDaFaixa(de, ate) > LIMITE_DIAS_DO_PAINEL) {
      onPeriodoDaPlanilha?.(faixa);
      return;
    }
    onChange(faixa);
  }

  return (
    // `contents`: o segmentado e o bloco das datas são itens da barra do Painel. Assim "Planilha"
    // fica ao lado do segmentado e as datas ocupam uma linha própria, na largura da barra.
    <div className={cn('contents', className)}>
      <FiltroPilulas
        rotulo="Período"
        ariaLabel="Período de análise dos indicadores"
        opcoes={OPCOES_PERIODO}
        valor={datas ? PERSONALIZADO : opcaoDoPeriodo(valor)}
        onChange={escolher}
        className=""
        ultimaEmLinhaPropria
      />

      {datas && (
        <div role="group" aria-label="Datas do período" className="order-last w-full basis-full space-y-2">
          <div className="flex gap-2">
            <div className="min-w-0 flex-1 md:w-40 md:flex-none">
              <Campo rotulo="De" htmlFor={idDe} erro={erros.de}>
                <Input
                  id={idDe}
                  type="date"
                  className="min-w-0"
                  max={hoje}
                  value={datas.de}
                  onChange={(evento) => editar({ ...datas, de: evento.target.value })}
                />
              </Campo>
            </div>
            <div className="min-w-0 flex-1 md:w-40 md:flex-none">
              <Campo rotulo="Até" htmlFor={idAte} erro={erros.ate}>
                <Input
                  id={idAte}
                  type="date"
                  className="min-w-0"
                  max={hoje}
                  value={datas.ate}
                  onChange={(evento) => editar({ ...datas, ate: evento.target.value })}
                />
              </Campo>
            </div>
          </div>
          {/* Sempre montada, vazia sem aviso: só o texto muda, para o leitor de tela anunciar. */}
          <p role="status" className={cn('text-sm text-muted-foreground', !acimaDoLimite && 'sr-only')}>
            {acimaDoLimite ? MENSAGEM_LIMITE_DO_PAINEL : ''}
          </p>
        </div>
      )}
    </div>
  );
}
