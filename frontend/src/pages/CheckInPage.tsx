/**
 * Tela de check-in de visita (UC07), no visual do protótipo
 * (`routes/checkin.$id.tsx`, Etapa 8): um cartão de 560 px com o cliente,
 * data e hora, campanha da visita, resultado, contato atendido, pedido (só
 * com resultado Venda), o que aconteceu na visita, foto, próxima visita |
 * lembrete, campanha da próxima visita (só com data) e as ações.
 *
 * Campanhas (spec 7.7): os dois selects listam só as não encerradas (status
 * do backend). Como no protótipo, os dois começam na campanha marcada para
 * esta visita no check-in anterior (a próxima visita do cliente), se ela
 * ainda não encerrou. Sem campanha escolhida, o campo não vai; sem data, a
 * campanha da próxima visita também não (o backend a apaga junto com a data).
 *
 * Próxima visita (spec 7.4): sugerida como a data da visita + a recorrência
 * do cliente, e acompanha a "Data e hora" até a representante mudar a data
 * ela mesma. Se a sugestão cairia antes de hoje (visita antiga lançada
 * depois), o campo fica vazio: sem data, a agenda segue a recorrência. Todo
 * check-in substitui a data marcada antes; sem data, vai `proximaVisita:
 * null`, que apaga só a data (e a campanha da próxima visita).
 *
 * Lembrete: tem data própria ("Para quando") e não depende da próxima
 * visita — pode existir sem data marcada, e um check-in novo não apaga os
 * lembretes abertos. "Para quando" começa na data da próxima visita (vazia
 * quando não há) e acompanha-a até a representante escolher outra. Com texto
 * e data válida (hoje ou depois), vai `lembrete: { texto, data }`; texto
 * sem data é erro no campo da data; sem texto, nada vai.
 *
 * O pedido começa com uma linha no primeiro produto do catálogo, sem
 * quantidade; vão para a API só as linhas com quantidade, e só com Venda
 * (trocar o resultado esconde o bloco e o pedido não vai). Sem o catálogo,
 * o bloco avisa e o check-in ainda pode ser salvo sem pedido.
 *
 * A data/hora vem preenchida com o agora e admite ajuste para lançar visita
 * já ocorrida. "+ Novo contato…" no select do contato abre o `NovoContato`
 * em linha; o contato criado fica selecionado. A foto é opcional: o
 * check-in é salvo primeiro e a foto enviada em seguida, comprimida, então
 * uma falha no upload não perde o registro — a ficha avisa e a timeline
 * oferece anexar depois. Sucesso: aviso "Check-in salvo" e volta à ficha.
 * Erros de validação ficam junto do campo (com o foco nele); o erro da API,
 * junto dos botões, sem perder o que foi digitado.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useCampanhas } from '../hooks/useCampanhas';
import { useProdutos } from '../hooks/useDadosErp';
import { campanhasNaoEncerradas, type Campanha } from '../services/campaigns';
import { comprimirImagem } from '../lib/comprimirImagem';
import { useDevolverFoco, useFocoNoPrimeiroErro } from '../lib/useFoco';
import { getCliente, mensagemErroApi, type Contato } from '../services/clients';
import { registrarCheckIn, enviarFoto } from '../services/visits';
import type { ItemPedido, ResultadoVisita } from '../services/visits';
import { AreaTextoCrescente } from '../components/AreaTextoCrescente';
import { SegmentadoResultado } from '../components/SegmentadoResultado';
import { NovoContato } from '../components/crm/NovoContato';
import { PedidoCampos } from '../components/crm/PedidoCampos';
import { Aviso, Campo, Cartao, CLASSES_SELECT } from '../components/crm/ui';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar o cliente.';
const MENSAGEM_ERRO_SALVAR = 'Não foi possível salvar o check-in.';
const MENSAGEM_ERRO_PRODUTOS = 'Não foi possível carregar os produtos.';

/** Valor da opção "+ Novo contato…" (não é id de contato). */
const NOVO_CONTATO = '__novo';

type Erros = Partial<Record<'dataHora' | 'contato' | 'descricao' | 'proximaVisita' | 'lembrete', string>>;

const MENSAGEM_PROXIMA_VISITA_PASSADA = 'A próxima visita não pode ser antes de hoje.';
const MENSAGEM_LEMBRETE_SEM_DATA = 'Informe a data do lembrete.';
const MENSAGEM_LEMBRETE_PASSADO = 'A data do lembrete não pode ser antes de hoje.';

/** `datetime-local` espera `YYYY-MM-DDTHH:mm` no fuso do dispositivo. */
function agoraParaCampoLocal(): string {
  const agora = new Date();
  const deslocamento = agora.getTimezoneOffset() * 60 * 1000;
  return new Date(agora.getTime() - deslocamento).toISOString().slice(0, 16);
}

/** Data `AAAA-MM-DD` + `dias`, em dias de calendário (sem passar pelo fuso). */
function somarDias(data: string, dias: number): string {
  const [ano, mes, dia] = data.split('-').map(Number);
  return new Date(Date.UTC(ano!, mes! - 1, dia! + dias)).toISOString().slice(0, 10);
}

/**
 * Data da visita (a parte da data de "Data e hora", no fuso do dispositivo)
 * + recorrência. Vazia sem data da visita ou quando cairia antes de `hoje`.
 */
function sugerirProximaVisita(dataHora: string, recorrenciaDias: number, hoje: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(dataHora)) return '';
  const sugestao = somarDias(dataHora.slice(0, 10), recorrenciaDias);
  return sugestao < hoje ? '' : sugestao;
}

/** Select de campanha não encerrada, com "Sem campanha" (valor vazio) primeiro. */
function SelectCampanha({
  id,
  rotulo,
  campanhas,
  valor,
  onChange,
}: {
  id: string;
  rotulo: string;
  campanhas: Campanha[];
  valor: string;
  onChange: (valor: string) => void;
}) {
  return (
    <Campo rotulo={rotulo} htmlFor={id}>
      <select id={id} className={cn(CLASSES_SELECT, 'w-full')} value={valor} onChange={(e) => onChange(e.target.value)}>
        <option value="">Sem campanha</option>
        {campanhas.map((campanha) => (
          <option key={campanha.id} value={campanha.id}>
            {campanha.nome}
          </option>
        ))}
      </select>
    </Campo>
  );
}

export function CheckInPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Mesma chave da ficha: vindo dela, o cliente já está no cache; e o
  // contato criado aqui (que invalida a chave) chega pela nova leitura.
  const {
    data: cliente,
    isLoading,
    error: erroCarregar,
  } = useQuery({ queryKey: ['client', id], queryFn: () => getCliente(id!), enabled: Boolean(id) });

  const [dataHora, setDataHora] = useState(agoraParaCampoLocal());
  const [resultado, setResultado] = useState<ResultadoVisita>('VENDA');
  const [contactId, setContactId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erros, setErros] = useState<Erros>({});
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const [novoContatoAberto, setNovoContatoAberto] = useState(false);
  // Contatos criados aqui, até a nova leitura do cliente trazê-los
  const [contatosCriados, setContatosCriados] = useState<Contato[]>([]);
  // `null` até a primeira mudança: antes disso o pedido é a linha inicial
  const [itensEditados, setItensEditados] = useState<ItemPedido[] | null>(null);
  // `null` até a representante mudar a data: antes disso vale a sugestão
  const [proximaVisitaEditada, setProximaVisitaEditada] = useState<string | null>(null);
  const [lembreteTexto, setLembreteTexto] = useState('');
  // `null` até a representante escolher: antes disso vale a data da próxima visita
  const [lembreteDataEditada, setLembreteDataEditada] = useState<string | null>(null);

  const hoje = agoraParaCampoLocal().slice(0, 10);
  const sugestao = cliente ? sugerirProximaVisita(dataHora, cliente.recorrenciaDias, hoje) : '';
  const proximaVisita = proximaVisitaEditada ?? sugestao;
  const lembreteData = lembreteDataEditada ?? proximaVisita;

  const { data: todasAsCampanhas } = useCampanhas();
  const campanhas = campanhasNaoEncerradas(todasAsCampanhas ?? []);
  // A campanha marcada para esta visita no check-in anterior, se ainda vale
  const idMarcado = cliente?.proximaCampanha?.id;
  const campanhaMarcada = idMarcado && campanhas.some((campanha) => campanha.id === idMarcado) ? idMarcado : '';
  // `null` até a representante escolher: antes disso vale a campanha marcada
  const [campanhaEditada, setCampanhaEditada] = useState<string | null>(null);
  const [proximaCampanhaEditada, setProximaCampanhaEditada] = useState<string | null>(null);
  const campanhaId = campanhaEditada ?? campanhaMarcada;
  const proximaCampanhaId = proximaCampanhaEditada ?? campanhaMarcada;

  const { data: produtos, isLoading: carregandoProdutos, isError: erroProdutos } = useProdutos();
  const primeiroProduto = produtos?.[0];
  const itens = itensEditados ?? (primeiroProduto ? [{ sku: primeiroProduto.sku, quantidade: 0 }] : []);

  const { ref: selectContato, devolverFoco } = useDevolverFoco<HTMLSelectElement>(novoContatoAberto);
  const { ref: formulario, focarPrimeiroErro } = useFocoNoPrimeiroErro<HTMLFormElement>();

  const contatosDoCliente = cliente?.contatos ?? [];
  const contatos = [
    ...contatosDoCliente,
    ...contatosCriados.filter((criado) => !contatosDoCliente.some((contato) => contato.id === criado.id)),
  ];

  useEffect(() => {
    if (!foto) {
      setPrevia(null);
      return;
    }

    const url = URL.createObjectURL(foto);
    setPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  function limparErro(campo: keyof Erros): void {
    setErros((anteriores) => ({ ...anteriores, [campo]: undefined }));
  }

  function escolherContato(valor: string): void {
    limparErro('contato');
    if (valor === NOVO_CONTATO) {
      setNovoContatoAberto(true);
      return;
    }
    setNovoContatoAberto(false);
    setContactId(valor);
  }

  function concluirNovoContato(criado?: Contato): void {
    devolverFoco();
    setNovoContatoAberto(false);
    limparErro('contato');
    if (criado) {
      setContatosCriados((anteriores) => [...anteriores, criado]);
      setContactId(criado.id);
    }
  }

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!id || salvando) return;

    const encontrados: Erros = {};
    if (!dataHora) encontrados.dataHora = 'Informe a data e a hora da visita.';
    // O contato digitado e não adicionado se perderia em silêncio
    if (novoContatoAberto) encontrados.contato = 'Adicione ou cancele o contato novo antes de salvar.';
    if (descricao.trim().length < 3) encontrados.descricao = 'Descreva a visita com pelo menos 3 caracteres.';
    if (proximaVisita && proximaVisita < hoje) encontrados.proximaVisita = MENSAGEM_PROXIMA_VISITA_PASSADA;
    if (lembreteTexto.trim()) {
      if (!lembreteData) encontrados.lembrete = MENSAGEM_LEMBRETE_SEM_DATA;
      else if (lembreteData < hoje) encontrados.lembrete = MENSAGEM_LEMBRETE_PASSADO;
    }
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) {
      focarPrimeiroErro();
      return;
    }

    setSalvando(true);
    setErroEnvio(null);

    const itensDoPedido = resultado === 'VENDA' ? itens.filter((item) => item.quantidade > 0) : [];
    const camposDaProximaVisita = proximaVisita
      ? { proximaVisita, ...(proximaCampanhaId ? { proximaCampanhaId } : {}) }
      : { proximaVisita: null };
    const lembrete = lembreteTexto.trim() ? { lembrete: { texto: lembreteTexto.trim(), data: lembreteData } } : {};

    try {
      const visita = await registrarCheckIn(id, {
        descricao: descricao.trim(),
        resultado,
        dataHora: new Date(dataHora).toISOString(),
        ...(campanhaId ? { campanhaId } : {}),
        ...(contactId ? { contactId } : {}),
        ...(itensDoPedido.length > 0 ? { itens: itensDoPedido } : {}),
        ...camposDaProximaVisita,
        ...lembrete,
      });

      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
      // As vendas e visitas vinculadas da campanha e o realizado das metas mudam
      queryClient.invalidateQueries({ queryKey: ['campanhas'] });
      queryClient.invalidateQueries({ queryKey: ['metas'] });
      queryClient.invalidateQueries({ queryKey: ['client', id, 'visits'] });
      queryClient.invalidateQueries({ queryKey: ['client', id] });
      queryClient.invalidateQueries({ queryKey: ['lembretes'] });

      if (foto) {
        try {
          const comprimida = await comprimirImagem(foto);
          await enviarFoto(visita.id, comprimida);
        } catch {
          // O check-in já está salvo; a ficha exibe o aviso e a timeline
          // oferece anexar a foto depois (UC07, fluxo de exceção E2).
          navigate(`/clientes/${id}`, { replace: true, state: { avisoFoto: 'nao-enviada' } });
          return;
        }
      }

      toast.success('Check-in salvo');
      navigate(`/clientes/${id}`, { replace: true });
    } catch (err: unknown) {
      setErroEnvio(mensagemErroApi(err, MENSAGEM_ERRO_SALVAR));
      setSalvando(false);
    }
  }

  return (
    <div className="mx-auto max-w-[560px] space-y-4">
      {!cliente && erroCarregar && (
        <Aviso tom="erro" role="alert">
          {mensagemErroApi(erroCarregar, MENSAGEM_ERRO_CARREGAR)}
        </Aviso>
      )}

      <Cartao>
        <form ref={formulario} onSubmit={salvar} noValidate className="space-y-5">
          {cliente ? (
            <p className="text-sm text-muted-foreground">
              Cliente: <b className="font-semibold text-foreground">{cliente.nomeFantasia}</b>
            </p>
          ) : (
            isLoading && <p className="text-sm text-muted-foreground">Carregando cliente...</p>
          )}

          <Campo
            rotulo="Data e hora"
            htmlFor="checkin-data-hora"
            ajuda="Já vem preenchido com agora; ajuste para lançar uma visita anterior."
            erro={erros.dataHora}
          >
            <Input
              id="checkin-data-hora"
              type="datetime-local"
              value={dataHora}
              onChange={(e) => {
                setDataHora(e.target.value);
                limparErro('dataHora');
              }}
              required
            />
          </Campo>

          <SelectCampanha
            id="checkin-campanha"
            rotulo="Campanha da visita (opcional)"
            campanhas={campanhas}
            valor={campanhaId}
            onChange={setCampanhaEditada}
          />

          <div className="space-y-1.5">
            {/* O grupo já se chama "Resultado"; o rótulo visível não é lido de novo */}
            <span aria-hidden="true" className="block text-sm font-medium">
              Resultado
            </span>
            <SegmentadoResultado valor={resultado} onChange={setResultado} rotulo="Resultado" />
          </div>

          <Campo rotulo="Contato atendido" htmlFor="checkin-contato" erro={erros.contato}>
            <select
              ref={selectContato}
              id="checkin-contato"
              className={cn(CLASSES_SELECT, 'w-full')}
              value={novoContatoAberto ? NOVO_CONTATO : contactId}
              onChange={(e) => escolherContato(e.target.value)}
            >
              <option value="">Não informar</option>
              {contatos.map((contato) => (
                <option key={contato.id} value={contato.id}>
                  {contato.nome} — {contato.cargo}
                </option>
              ))}
              <option value={NOVO_CONTATO}>+ Novo contato…</option>
            </select>
          </Campo>

          {novoContatoAberto && id && <NovoContato clienteId={id} aoConcluir={concluirNovoContato} />}

          {resultado === 'VENDA' && (
            <PedidoCampos
              produtos={produtos ?? []}
              itens={itens}
              aoMudar={setItensEditados}
              aviso={
                erroProdutos ? (
                  <Aviso tom="erro" role="alert">
                    {MENSAGEM_ERRO_PRODUTOS}
                  </Aviso>
                ) : (
                  carregandoProdutos && <p className="text-sm text-muted-foreground">Carregando produtos...</p>
                )
              }
            />
          )}

          <Campo rotulo="O que aconteceu na visita" htmlFor="checkin-descricao" erro={erros.descricao}>
            <AreaTextoCrescente
              id="checkin-descricao"
              value={descricao}
              onChange={(e) => {
                setDescricao(e.target.value);
                limparErro('descricao');
              }}
              rows={4}
              placeholder="Ex.: Reposição do mostruário e pedido de trufas para o fim de semana."
              required
            />
          </Campo>

          <div className="space-y-2">
            <Campo
              rotulo="Foto (opcional)"
              htmlFor="checkin-foto"
              ajuda="Registra que você esteve no cliente."
            >
              <Input
                id="checkin-foto"
                type="file"
                accept="image/*"
                capture="environment"
                className="cursor-pointer file:mr-3 file:cursor-pointer max-md:py-2.5"
                onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
              />
            </Campo>
            {previa && (
              <img
                src={previa}
                alt="Prévia da foto do check-in"
                className="max-h-56 w-full rounded-lg border object-cover"
              />
            )}
          </div>

          <div className="space-y-1.5">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo rotulo="Próxima visita" htmlFor="checkin-proxima-visita" erro={erros.proximaVisita}>
                <Input
                  id="checkin-proxima-visita"
                  type="date"
                  min={hoje}
                  value={proximaVisita}
                  aria-describedby="checkin-proxima-visita-ajuda"
                  onChange={(e) => {
                    setProximaVisitaEditada(e.target.value);
                    limparErro('proximaVisita');
                  }}
                />
              </Campo>
            </div>
            <p id="checkin-proxima-visita-ajuda" className="text-xs text-muted-foreground">
              {cliente && `Sugestão: data da visita + recorrência de ${cliente.recorrenciaDias} dias. `}
              Sem data, a agenda segue a recorrência.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Lembrete (opcional)" htmlFor="checkin-lembrete">
              <Input
                id="checkin-lembrete"
                value={lembreteTexto}
                maxLength={200}
                placeholder="Ex.: levar amostras de Natal"
                onChange={(e) => {
                  setLembreteTexto(e.target.value);
                  limparErro('lembrete');
                }}
              />
            </Campo>
            <Campo rotulo="Para quando" htmlFor="checkin-lembrete-data" erro={erros.lembrete}>
              <Input
                id="checkin-lembrete-data"
                type="date"
                min={hoje}
                value={lembreteData}
                onChange={(e) => {
                  setLembreteDataEditada(e.target.value);
                  limparErro('lembrete');
                }}
              />
            </Campo>
          </div>

          {proximaVisita && (
            <SelectCampanha
              id="checkin-proxima-campanha"
              rotulo="Campanha da próxima visita (opcional)"
              campanhas={campanhas}
              valor={proximaCampanhaId}
              onChange={setProximaCampanhaEditada}
            />
          )}

          {erroEnvio && (
            <Aviso tom="erro" role="alert">
              {erroEnvio}
            </Aviso>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button type="submit" className="w-full sm:w-auto" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar check-in'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate(`/clientes/${id}`)}>
              Cancelar
            </Button>
          </div>
        </form>
      </Cartao>
    </div>
  );
}
