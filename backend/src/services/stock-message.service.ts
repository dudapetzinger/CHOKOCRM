import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/errorCodes';
import * as clientRepository from '../repositories/client.repository';
import * as userRepository from '../repositories/user.repository';
import { exigirClienteDaCarteira, type UsuarioAutenticado } from './carteira';
import { eventoVigente } from './seasonal-event.service';
import { montarMensagemDeEstoque, nomeDoEventoNoTemplate } from './stock-message.template';
import { agora } from '../lib/relogio';

const MENSAGEM_CLIENTE_NAO_ENCONTRADO = 'Cliente não encontrado.';

export type PropostaDTO = {
  evento: { id: string; nome: string; produtosSugeridos: string[] } | null;
  contatos: { id: string; nome: string; telefone: string; principal: boolean }[];
  telefoneCliente: string;
  textoSugerido: string;
  textosSugeridos: { contactId: string | null; texto: string }[];
};

/**
 * Proposta de mensagem de estoque: não escreve nada, apenas monta o texto
 * sugerido a partir do cliente, do evento sazonal vigente (se houver) e do
 * nome do usuário logado.
 */
export async function propor(
  clientId: string,
  usuario: UsuarioAutenticado,
  hoje: Date = agora(),
): Promise<PropostaDTO> {
  const cliente = await clientRepository.findById(clientId);
  if (!cliente) {
    throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_CLIENTE_NAO_ENCONTRADO, 404);
  }

  exigirClienteDaCarteira(cliente, usuario);

  const usuarioLogado = await userRepository.findById(usuario.id);
  const evento = await eventoVigente(hoje);
  const eventoTemplate = evento
    ? { nome: nomeDoEventoNoTemplate(evento.nome), produtosSugeridos: evento.produtosSugeridos }
    : null;
  const nomeRepresentante = usuarioLogado?.nome ?? '';

  // Uma saudação por destinatário possível: um item por contato, mais um
  // com `contactId: null` para a opção "telefone do cliente" (saudação
  // genérica "cliente"). O front troca o texto ao trocar "Enviar para"
  // enquanto o representante não tiver editado a sugestão.
  const textosSugeridos = [
    ...cliente.contacts.map((contato) => ({
      contactId: contato.id,
      texto: montarMensagemDeEstoque({
        nomeContato: contato.nome,
        nomeFantasia: cliente.nomeFantasia,
        nomeRepresentante,
        evento: eventoTemplate,
      }),
    })),
    {
      contactId: null,
      texto: montarMensagemDeEstoque({
        nomeContato: null,
        nomeFantasia: cliente.nomeFantasia,
        nomeRepresentante,
        evento: eventoTemplate,
      }),
    },
  ];

  const contatoPrincipal = cliente.contacts.find((contato) => contato.principal) ?? null;
  const textoSugerido =
    textosSugeridos.find((item) => item.contactId === (contatoPrincipal?.id ?? null))?.texto ??
    textosSugeridos[textosSugeridos.length - 1]!.texto;

  return {
    evento: evento ? { id: evento.id, nome: evento.nome, produtosSugeridos: evento.produtosSugeridos } : null,
    contatos: cliente.contacts.map((contato) => ({
      id: contato.id,
      nome: contato.nome,
      telefone: contato.telefone,
      principal: contato.principal,
    })),
    telefoneCliente: cliente.telefone,
    textoSugerido,
    textosSugeridos,
  };
}
