/**
 * Aviso da próxima visita na ficha do cliente (spec 7.2 e 7.4; aviso de
 * `crm/ficha.tsx` do protótipo), logo abaixo do cabeçalho: "Próxima visita:
 * dd/mm/aaaa" quando há data marcada e a etiqueta da campanha da próxima
 * visita (spec 7.7). Abaixo, os lembretes abertos do cliente (Etapa 9: o
 * lembrete tem data própria, independente da visita), cada um com o texto, o
 * prazo embaixo (`descreverPrazoDoLembrete`) e, com `podeConcluir`, o botão
 * "Concluir" à direita.
 *
 * Etapa 11b: com `podeEditar`, a data se marca, muda ou limpa aqui mesmo
 * (antes só o check-in gravava). O botão "Alterar data" (ou "Marcar próxima
 * visita", quando não há data; nesse caso o aviso aparece mesmo sem campanha
 * nem lembrete) abre um campo de data (`min` = hoje no aparelho) com "Salvar",
 * "Cancelar" e, havendo data, "Limpar data". Quem grava é a página
 * (`onSalvarData`, que resolve o toast e o cache): o componente só guarda se o
 * campo está aberto, o valor e o erro, que vem da promise rejeitada e fica no
 * bloco com o campo aberto; data anterior a hoje digitada à mão é recusada
 * antes de chamar a API. O foco vai para o campo ao abrir e volta ao botão de
 * edição ao fechar. Sem data marcada, a agenda segue a recorrência;
 * sem `podeEditar` e sem data, campanha nem lembrete, não desenha nada: quem
 * usa pode sempre passar tudo.
 *
 * Texto marrom sobre o laranja suave (9,6:1, spec 6.3); o ícone é decorativo
 * e usa o laranja vivo do protótipo.
 */
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { CalendarClock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { hojeEmSaoPaulo } from '@/lib/calendario';
import { formatarDataCalendario } from '@/lib/formatarData';
import { descreverPrazoDoLembrete } from '@/lib/descreverPrazo';
import { useDevolverFoco } from '@/lib/useFoco';
import { mensagemErroApi } from '@/services/clients';
import type { LembreteItem } from '@/services/lembretes';
import { BotaoConcluirLembrete } from '../BotaoConcluirLembrete';
import { EtiquetaCampanha } from './EtiquetaCampanha';
import { Aviso, Campo } from './ui';

type Props = {
  /** Data marcada (`AAAA-MM-DD`); `null` quando a agenda segue a recorrência. */
  data: string | null;
  /** Nome da campanha da próxima visita (spec 7.7). */
  campanha?: string | null;
  /** Os lembretes abertos do cliente, por data. */
  lembretes: LembreteItem[];
  /** O dono da carteira e o gestor concluem lembretes. */
  podeConcluir: boolean;
  /** O dono da carteira e o gestor marcam, mudam e limpam a data. */
  podeEditar: boolean;
  /** Grava a data (`AAAA-MM-DD`) ou a limpa (`null`); rejeitar mostra o erro no bloco. */
  onSalvarData?: (data: string | null) => Promise<void>;
};

export function AvisoProximaVisita({ data, campanha, lembretes, podeConcluir, podeEditar, onSalvarData }: Props) {
  const idLembretes = useId();
  const idCampo = useId();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState('');
  const [erroDoCampo, setErroDoCampo] = useState<string | null>(null);
  const [erroDaApi, setErroDaApi] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const campoDaData = useRef<HTMLInputElement>(null);
  const { ref: botaoDeEditar, devolverFoco } = useDevolverFoco<HTMLButtonElement>(editando);

  // O botão sai da tela quando o campo abre: o foco vai para o campo.
  useEffect(() => {
    if (editando) campoDaData.current?.focus();
  }, [editando]);

  if (!podeEditar && !data && !campanha && lembretes.length === 0) return null;

  function abrir() {
    setValor(data ?? '');
    setErroDoCampo(null);
    setErroDaApi(null);
    setEditando(true);
  }

  function fechar() {
    devolverFoco();
    setEditando(false);
    setErroDoCampo(null);
    setErroDaApi(null);
  }

  async function gravar(novaData: string | null) {
    if (!onSalvarData) return;
    setSalvando(true);
    setErroDaApi(null);
    try {
      await onSalvarData(novaData);
      devolverFoco();
      setEditando(false);
    } catch (err) {
      setErroDaApi(mensagemErroApi(err, 'Não foi possível salvar a próxima visita.'));
    } finally {
      setSalvando(false);
    }
  }

  function aoSalvar(evento: FormEvent) {
    evento.preventDefault();
    if (!valor) {
      setErroDoCampo('Informe a data.');
      return;
    }
    if (valor < hojeEmSaoPaulo()) {
      setErroDoCampo('A próxima visita não pode ser antes de hoje.');
      return;
    }
    setErroDoCampo(null);
    void gravar(valor);
  }

  const mostrarLinha = Boolean(data || campanha || (podeEditar && !editando));

  return (
    <div
      role="note"
      className="flex items-start gap-3 rounded-xl border border-primary/30 bg-primary-soft p-4 text-sm text-brown"
    >
      <CalendarClock aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary-vivo" />
      <div className="min-w-0 flex-1 space-y-2 break-words">
        {mostrarLinha && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {data && !editando && (
              <span>
                <b className="font-semibold">Próxima visita:</b> {formatarDataCalendario(data)}
              </span>
            )}
            {campanha && <EtiquetaCampanha nome={campanha} />}
            {podeEditar && !editando && (
              <Button ref={botaoDeEditar} type="button" variant="outline" size="sm" onClick={abrir}>
                {data ? 'Alterar data' : 'Marcar próxima visita'}
              </Button>
            )}
          </div>
        )}
        {podeEditar && editando && (
          <form onSubmit={aoSalvar} className="space-y-2" noValidate>
            <Campo
              rotulo="Próxima visita"
              htmlFor={idCampo}
              ajuda="A agenda passa a usar esta data em vez da recorrência."
              erro={erroDoCampo}
            >
              <Input
                ref={campoDaData}
                id={idCampo}
                type="date"
                min={hojeEmSaoPaulo()}
                value={valor}
                onChange={(evento) => {
                  setValor(evento.target.value);
                  setErroDoCampo(null);
                }}
                className="max-w-48 bg-card"
              />
            </Campo>
            {erroDaApi && (
              <Aviso tom="erro" role="alert">
                {erroDaApi}
              </Aviso>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" size="sm" disabled={salvando}>
                Salvar
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={fechar} disabled={salvando}>
                Cancelar
              </Button>
              {data && (
                <Button type="button" variant="outline" size="sm" onClick={() => void gravar(null)} disabled={salvando}>
                  Limpar data
                </Button>
              )}
            </div>
          </form>
        )}
        {lembretes.length > 0 && (
          <div className="space-y-1">
            <p id={idLembretes} className="font-semibold">
              Lembretes
            </p>
            <ul aria-labelledby={idLembretes} className="space-y-2">
              {lembretes.map((lembrete) => (
                <li key={lembrete.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block">{lembrete.texto}</span>
                    {/* O prazo vem em minúscula (`descreverPrazoDoLembrete`); na linha própria, a inicial é maiúscula só no visual. */}
                    <span className="block text-xs first-letter:uppercase">
                      {descreverPrazoDoLembrete(lembrete.diasAtraso, lembrete.data)}
                    </span>
                  </span>
                  {podeConcluir && (
                    <BotaoConcluirLembrete lembreteId={lembrete.id} rotulo={`Concluir lembrete: ${lembrete.texto}`} />
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
