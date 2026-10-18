/**
 * Tela de check-in de visita (UC07), no visual do protótipo
 * (`routes/checkin.$id.tsx`, Etapa 8): um cartão de 560 px com o cliente,
 * data e hora, resultado, contato atendido, o que aconteceu na visita, foto
 * e as ações. Os blocos que ainda não existem no app (pedido, próxima
 * visita, campanhas) entram depois, nesta mesma ordem.
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
import { comprimirImagem } from '../lib/comprimirImagem';
import { useDevolverFoco, useFocoNoPrimeiroErro } from '../lib/useFoco';
import { getCliente, mensagemErroApi, type Contato } from '../services/clients';
import { registrarCheckIn, enviarFoto } from '../services/visits';
import type { ResultadoVisita } from '../services/visits';
import { AreaTextoCrescente } from '../components/AreaTextoCrescente';
import { SegmentadoResultado } from '../components/SegmentadoResultado';
import { NovoContato } from '../components/crm/NovoContato';
import { Aviso, Campo, Cartao, CLASSES_SELECT } from '../components/crm/ui';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar o cliente.';
const MENSAGEM_ERRO_SALVAR = 'Não foi possível salvar o check-in.';

/** Valor da opção "+ Novo contato…" (não é id de contato). */
const NOVO_CONTATO = '__novo';

type Erros = Partial<Record<'dataHora' | 'contato' | 'descricao', string>>;

/** `datetime-local` espera `YYYY-MM-DDTHH:mm` no fuso do dispositivo. */
function agoraParaCampoLocal(): string {
  const agora = new Date();
  const deslocamento = agora.getTimezoneOffset() * 60 * 1000;
  return new Date(agora.getTime() - deslocamento).toISOString().slice(0, 16);
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
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) {
      focarPrimeiroErro();
      return;
    }

    setSalvando(true);
    setErroEnvio(null);

    try {
      const visita = await registrarCheckIn(id, {
        descricao: descricao.trim(),
        resultado,
        dataHora: new Date(dataHora).toISOString(),
        ...(contactId ? { contactId } : {}),
      });

      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['agenda'] });
      queryClient.invalidateQueries({ queryKey: ['client', id, 'visits'] });
      queryClient.invalidateQueries({ queryKey: ['client', id] });

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
              ajuda="Registra que você esteve no cliente. Pode salvar sem foto."
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
