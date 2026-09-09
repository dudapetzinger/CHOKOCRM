/**
 * Campos de um contato (nome, cargo, telefone, e-mail e "principal").
 *
 * Reaproveitado em dois contextos:
 * - `NovoClientePage`: uma linha por contato de uma lista dinâmica, onde
 *   "principal" é um radio (só um contato do array pode ser o principal) —
 *   passar `principalControl={{ tipo: 'radio', ... }}`.
 * - `ClienteDetalhePage`: formulário isolado de um único contato (novo ou em
 *   edição), onde "principal" é um checkbox independente — o backend cuida
 *   de rebaixar o principal anterior automaticamente ao promover outro (ver
 *   `contact.service.ts`) — passar `principalControl={{ tipo: 'checkbox' }}`.
 */
export type ContatoFormValue = {
  nome: string;
  cargo: string;
  telefone: string;
  email: string;
  principal: boolean;
};

export function contatoFormularioVazio(principal: boolean): ContatoFormValue {
  return { nome: '', cargo: '', telefone: '', email: '', principal };
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validação client-side de um contato, espelhando `contatoSchema`/
 * `createContactSchema` (zod, backend): nome/cargo/telefone obrigatórios e
 * e-mail em formato válido. Retorna `null` quando válido.
 */
export function validarContatoFormulario(contato: ContatoFormValue): string | null {
  if (!contato.nome.trim() || !contato.cargo.trim() || !contato.telefone.trim()) {
    return 'Preencha nome, cargo e telefone do contato.';
  }
  if (!EMAIL_REGEX.test(contato.email.trim())) {
    return 'E-mail do contato inválido.';
  }
  return null;
}

type PrincipalControl =
  | { tipo: 'radio'; name: string; onSelecionarPrincipal: () => void }
  | { tipo: 'checkbox' };

type ContatoFieldsProps = {
  idPrefix: string;
  legenda: string;
  value: ContatoFormValue;
  onChange: (value: ContatoFormValue) => void;
  principalControl: PrincipalControl;
  onRemover?: () => void;
  removerDesabilitado?: boolean;
  erro?: string | null;
  disabled?: boolean;
};

export function ContatoFields({
  idPrefix,
  legenda,
  value,
  onChange,
  principalControl,
  onRemover,
  removerDesabilitado,
  erro,
  disabled,
}: ContatoFieldsProps) {
  function atualizar<K extends keyof ContatoFormValue>(campo: K, valor: ContatoFormValue[K]): void {
    onChange({ ...value, [campo]: valor });
  }

  return (
    <fieldset className="contato-linha" disabled={disabled}>
      <legend className="contato-linha-legenda">{legenda}</legend>
      {onRemover && (
        <button
          type="button"
          className="contato-linha-remover"
          onClick={onRemover}
          disabled={removerDesabilitado}
        >
          Remover
        </button>
      )}

      <div className="campo">
        <label htmlFor={`${idPrefix}-nome`}>Nome</label>
        <input
          type="text"
          id={`${idPrefix}-nome`}
          value={value.nome}
          onChange={(event) => atualizar('nome', event.target.value)}
        />
      </div>

      <div className="campo">
        <label htmlFor={`${idPrefix}-cargo`}>Cargo</label>
        <input
          type="text"
          id={`${idPrefix}-cargo`}
          value={value.cargo}
          onChange={(event) => atualizar('cargo', event.target.value)}
        />
      </div>

      <div className="campo">
        <label htmlFor={`${idPrefix}-telefone`}>Telefone</label>
        <input
          type="tel"
          id={`${idPrefix}-telefone`}
          value={value.telefone}
          onChange={(event) => atualizar('telefone', event.target.value)}
        />
      </div>

      <div className="campo">
        <label htmlFor={`${idPrefix}-email`}>E-mail</label>
        <input
          type="email"
          id={`${idPrefix}-email`}
          value={value.email}
          onChange={(event) => atualizar('email', event.target.value)}
        />
      </div>

      <label className="contato-principal-opcao" htmlFor={`${idPrefix}-principal`}>
        {principalControl.tipo === 'radio' ? (
          <input
            type="radio"
            id={`${idPrefix}-principal`}
            name={principalControl.name}
            checked={value.principal}
            onChange={principalControl.onSelecionarPrincipal}
          />
        ) : (
          <input
            type="checkbox"
            id={`${idPrefix}-principal`}
            checked={value.principal}
            onChange={(event) => atualizar('principal', event.target.checked)}
          />
        )}
        Contato principal
      </label>

      {erro && (
        <p className="erro-campo" role="alert">
          {erro}
        </p>
      )}
    </fieldset>
  );
}

export default ContatoFields;
