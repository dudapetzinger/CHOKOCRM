/**
 * Cabeçalho da ficha do cliente (Etapa 7, spec 5.5): o que se usa em campo
 * primeiro — nome, cidade, etiqueta de situação, o telefone do contato
 * principal (ou o do cliente) com atalhos para ligar e abrir o WhatsApp e,
 * para o gestor, o representante da carteira.
 */
import { descreverSituacao } from '../lib/descreverSituacao';
import { telefoneParaWaMe } from '../lib/telefone';
import type { ClienteCompleto } from '../services/clients';
import { BadgeCor } from './BadgeCor';
import { EtiquetaSituacao } from './EtiquetaSituacao';
import { Icone } from './Icone';

type Props = {
  cliente: ClienteCompleto;
  mostrarRepresentante: boolean;
};

export function CabecalhoCliente({ cliente, mostrarRepresentante }: Props) {
  const contatoPrincipal = cliente.contatos.find((contato) => contato.principal);
  const telefone = contatoPrincipal?.telefone ?? cliente.telefone;
  const numeroInternacional = telefoneParaWaMe(telefone);

  return (
    <section className="card cabecalho-cliente" aria-labelledby="titulo-cabecalho-cliente">
      <h2 id="titulo-cabecalho-cliente" className="cabecalho-cliente-nome">
        {cliente.nomeFantasia}
      </h2>
      <p className="cabecalho-cliente-linha">
        <BadgeCor cor={cliente.cor} />
        <span>{cliente.cidade}</span>
        {!cliente.ativo && <span className="etiqueta">Inativo</span>}
      </p>
      <EtiquetaSituacao
        cor={cliente.cor}
        texto={descreverSituacao({
          cor: cliente.cor,
          diasSemVisita: cliente.diasSemVisita,
          rebaixadoPorVenda: cliente.rebaixadoPorVenda,
          diasSemCompra: cliente.diasSemCompra,
        })}
      />
      {mostrarRepresentante && <p className="cabecalho-cliente-linha">Rep.: {cliente.representante.nome}</p>}

      {numeroInternacional && (
        <>
          <p className="cabecalho-cliente-linha">
            {contatoPrincipal ? `${contatoPrincipal.nome} · ${telefone}` : telefone}
          </p>
          <div className="cabecalho-cliente-acoes">
            <a className="btn-secundario" href={`tel:+${numeroInternacional}`} aria-label="Ligar">
              <Icone nome="phone" tamanho={16} />
              Ligar
            </a>
            <a
              className="btn-secundario"
              href={`https://wa.me/${numeroInternacional}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
            >
              <Icone nome="message-circle" tamanho={16} />
              WhatsApp
            </a>
          </div>
        </>
      )}
    </section>
  );
}
