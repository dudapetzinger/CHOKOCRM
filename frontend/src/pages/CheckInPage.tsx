/**
 * Tela de check-in de visita (UC07). A data/hora vem preenchida com o
 * agora e admite ajuste para lançar visita já ocorrida. A foto é opcional:
 * o check-in é salvo primeiro e a foto enviada em seguida, então uma falha
 * no upload não perde o registro — a timeline oferece anexar depois.
 */
import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { comprimirImagem } from '../lib/comprimirImagem';
import { getCliente, mensagemErroApi } from '../services/clients';
import type { ClienteCompleto } from '../services/clients';
import { registrarCheckIn, enviarFoto, ROTULO_RESULTADO } from '../services/visits';
import type { ResultadoVisita } from '../services/visits';

/** `datetime-local` espera `YYYY-MM-DDTHH:mm` no fuso do dispositivo. */
function agoraParaCampoLocal(): string {
  const agora = new Date();
  const deslocamento = agora.getTimezoneOffset() * 60 * 1000;
  return new Date(agora.getTime() - deslocamento).toISOString().slice(0, 16);
}

const RESULTADOS: ResultadoVisita[] = ['VENDA', 'NEGOCIACAO', 'SEM_VENDA'];

export function CheckInPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [cliente, setCliente] = useState<ClienteCompleto | null>(null);
  const [dataHora, setDataHora] = useState(agoraParaCampoLocal());
  const [resultado, setResultado] = useState<ResultadoVisita>('VENDA');
  const [contactId, setContactId] = useState('');
  const [descricao, setDescricao] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [previa, setPrevia] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    getCliente(id)
      .then(setCliente)
      .catch((err: unknown) => setErro(mensagemErroApi(err, 'Não foi possível carregar o cliente.')));
  }, [id]);

  useEffect(() => {
    if (!foto) {
      setPrevia(null);
      return;
    }

    const url = URL.createObjectURL(foto);
    setPrevia(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  async function salvar(evento: FormEvent) {
    evento.preventDefault();
    if (!id) return;

    if (descricao.trim().length < 3) {
      setErro('Descreva a visita com pelo menos 3 caracteres.');
      return;
    }

    setSalvando(true);
    setErro(null);

    try {
      const visita = await registrarCheckIn(id, {
        descricao: descricao.trim(),
        resultado,
        dataHora: new Date(dataHora).toISOString(),
        ...(contactId ? { contactId } : {}),
      });

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

      navigate(`/clientes/${id}`, { replace: true });
    } catch (err: unknown) {
      setErro(mensagemErroApi(err, 'Não foi possível salvar o check-in.'));
      setSalvando(false);
    }
  }

  return (
    <div className="container">
      <header className="topo">
        <button type="button" className="topo-acao" onClick={() => navigate(`/clientes/${id}`)}>
          Voltar
        </button>
        <h1>Novo check-in</h1>
      </header>

      <main className="conteudo">
        {cliente && <p className="cliente-info">{cliente.nomeFantasia}</p>}
        {erro && <p className="erro-campo">{erro}</p>}

        <form className="card" onSubmit={salvar}>
          <label className="campo">
            <span className="etiqueta">Data e hora da visita</span>
            <input type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} required />
            <span className="campo-ajuda">Já vem preenchido com agora; ajuste para lançar uma visita anterior.</span>
          </label>

          <label className="campo">
            <span className="etiqueta">Resultado</span>
            <select value={resultado} onChange={(e) => setResultado(e.target.value as ResultadoVisita)}>
              {RESULTADOS.map((opcao) => (
                <option key={opcao} value={opcao}>
                  {ROTULO_RESULTADO[opcao]}
                </option>
              ))}
            </select>
          </label>

          <label className="campo">
            <span className="etiqueta">Contato atendido (opcional)</span>
            <select value={contactId} onChange={(e) => setContactId(e.target.value)}>
              <option value="">Não informar</option>
              {cliente?.contatos.map((contato) => (
                <option key={contato.id} value={contato.id}>
                  {contato.nome} — {contato.cargo}
                </option>
              ))}
            </select>
          </label>

          <label className="campo">
            <span className="etiqueta">O que aconteceu na visita</span>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              rows={4}
              placeholder="Ex.: reposição do mostruário; pediu catálogo de Páscoa."
              required
            />
          </label>

          <div className="campo">
            <span className="etiqueta">Foto de comprovação (opcional)</span>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
            />
            <span className="campo-ajuda">Registra que você esteve no cliente. Pode salvar sem foto.</span>
            {previa && <img className="visita-previa" src={previa} alt="Prévia da foto do check-in" />}
          </div>

          <div className="acoes-linha">
            <button type="submit" className="btn-primario" disabled={salvando}>
              {salvando ? 'Salvando...' : 'Salvar check-in'}
            </button>
            <button type="button" className="btn-secundario" onClick={() => navigate(`/clientes/${id}`)}>
              Cancelar
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
