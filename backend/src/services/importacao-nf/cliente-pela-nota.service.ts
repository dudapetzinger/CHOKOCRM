/**
 * Cliente pela nota fiscal: o gestor vê os CNPJs das notas importadas sem
 * cliente no CRM (`SEM_CLIENTE`) e cria o cliente com os dados da DANFE mais
 * recente, na carteira do representante escolhido. Numa transação só: cria o
 * cliente (sem e-mail e sem contatos), liga a ele todas as notas
 * `SEM_CLIENTE` do CNPJ e decide o vínculo de cada uma com as regras da
 * importação (`adotarNotasSemCliente`, o mesmo do cadastro pelo
 * representante). Provisório até a API do Senior X.
 */
import { AppError } from '../../errors/AppError';
import { ErrorCode } from '../../errors/errorCodes';
import { prisma } from '../../lib/prisma';
import * as clientRepository from '../../repositories/client.repository';
import * as erpSaleRepository from '../../repositories/erp-sale.repository';
import type { DestinatarioDaNota } from '../../repositories/erp-sale.repository';
import type { CriarClientePelaNotaInput } from '../../schemas/cliente-pela-nota.schema';
import type { UsuarioAutenticado } from '../carteira';
import { dataDaColunaDate } from '../classificacao.service';
import { getClientById, mapPrismaUniqueError, type ClienteCompletoDTO } from '../client.service';
import { adotarNotasSemCliente } from './importacao.service';

const MENSAGEM_CNPJ_JA_CADASTRADO = 'Já existe um cliente com este CNPJ.';
const MENSAGEM_REPRESENTANTE_INVALIDO = 'Representante inválido.';
const MENSAGEM_SEM_NOTA = 'Nenhuma nota sem cliente para este CNPJ.';

const RECORRENCIA_PADRAO = 15;
const OPCOES_DA_TRANSACAO = { timeout: 30_000, maxWait: 10_000 };

export type SemClienteDTO = {
  cnpj: string;
  razaoSocial: string;
  endereco: string | null;
  bairro: string | null;
  cep: string | null;
  municipio: string | null;
  uf: string | null;
  telefone: string | null;
  /** Quantas notas `SEM_CLIENTE` o CNPJ tem. */
  notas: number;
  /** AAAA-MM-DD da nota mais recente. */
  ultimaEmissao: string;
};

function paraSemClienteDTO(nota: DestinatarioDaNota, notas: number): SemClienteDTO {
  return {
    cnpj: nota.destinatarioCnpj,
    razaoSocial: nota.destinatarioNome,
    endereco: nota.destinatarioEndereco,
    bairro: nota.destinatarioBairro,
    cep: nota.destinatarioCep,
    municipio: nota.destinatarioMunicipio,
    uf: nota.destinatarioUf,
    telefone: nota.destinatarioTelefone,
    notas,
    ultimaEmissao: dataDaColunaDate(nota.dataEmissao),
  };
}

/**
 * Endereço do cliente no formato do cadastro: `"<endereço> - <bairro>,
 * <município>/<UF>"`, omitindo as partes ausentes junto com o separador. Sem
 * endereço e sem bairro, devolve `''`: só município/UF não é endereço, e o
 * vazio faz a ficha mostrar um traço e a edição pedir o endereço.
 */
export function montarEndereco(nota: {
  destinatarioEndereco: string | null;
  destinatarioBairro: string | null;
  destinatarioMunicipio: string | null;
  destinatarioUf: string | null;
}): string {
  const rua = [nota.destinatarioEndereco, nota.destinatarioBairro].filter(Boolean).join(' - ');
  if (rua === '') return '';
  const cidade = [nota.destinatarioMunicipio, nota.destinatarioUf].filter(Boolean).join('/');
  return [rua, cidade].filter(Boolean).join(', ');
}

/** CNPJs com nota sem cliente, da última emissão mais recente para a mais antiga. */
export async function listarSemCliente(): Promise<SemClienteDTO[]> {
  const grupos = await erpSaleRepository.listarSemClientePorCnpj();
  return grupos.map((g) => paraSemClienteDTO(g.maisRecente, g.notas));
}

/**
 * Cria o cliente do CNPJ com os dados da nota mais recente e liga a ele as
 * notas sem cliente. 409 se o CNPJ já tem cliente (inclusive quando o
 * representante o cadastra pelo app ao mesmo tempo: o índice único do CNPJ
 * desfaz a transação), 400 se o representante não é um REPRESENTANTE ativo,
 * 404 sem nota `SEM_CLIENTE` do CNPJ. Devolve a ficha (`GET /clients/:id`).
 */
export async function criarClientePelaNota(
  cnpj: string,
  dados: CriarClientePelaNotaInput,
  usuario: UsuarioAutenticado,
): Promise<ClienteCompletoDTO> {
  let clienteId: string;
  try {
    clienteId = await prisma.$transaction(async (tx) => {
      if ((await erpSaleRepository.findClienteIdPorCnpj(cnpj, tx)) !== null) {
        throw new AppError(ErrorCode.CONFLICT, MENSAGEM_CNPJ_JA_CADASTRADO, 409);
      }
      const representante = await tx.user.findUnique({
        where: { id: dados.representanteId },
        select: { role: true, ativo: true },
      });
      if (representante?.role !== 'REPRESENTANTE' || !representante.ativo) {
        throw new AppError(ErrorCode.VALIDATION_ERROR, MENSAGEM_REPRESENTANTE_INVALIDO, 400);
      }
      const maisRecente = (await erpSaleRepository.listarSemClienteDoCnpj(cnpj, tx)).at(-1);
      if (maisRecente === undefined) {
        throw new AppError(ErrorCode.NOT_FOUND, MENSAGEM_SEM_NOTA, 404);
      }

      const id = await clientRepository.createWithContacts(
        {
          razaoSocial: maisRecente.destinatarioNome,
          nomeFantasia: dados.nomeFantasia ?? maisRecente.destinatarioNome,
          cnpj,
          cidade: maisRecente.destinatarioMunicipio ?? '',
          endereco: montarEndereco(maisRecente),
          telefone: maisRecente.destinatarioTelefone ?? '',
          email: null,
          recorrenciaDias: dados.recorrenciaDias ?? RECORRENCIA_PADRAO,
          contatos: [],
        },
        dados.representanteId,
        tx,
      );

      await adotarNotasSemCliente(tx, cnpj, id);
      return id;
    }, OPCOES_DA_TRANSACAO);
  } catch (err) {
    throw mapPrismaUniqueError(err);
  }

  return getClientById(clienteId, usuario);
}
