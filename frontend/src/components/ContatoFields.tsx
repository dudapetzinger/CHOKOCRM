/**
 * Campos de um contato (nome, cargo, telefone, e-mail e "principal").
 *
 * Na ficha do cliente (`DadosCadastrais`) é o formulário isolado de um único
 * contato em edição, onde "principal" é um checkbox independente (o backend
 * cuida de rebaixar o principal anterior automaticamente ao promover outro,
 * ver `contact.service.ts`).
 *
 * Visual do protótipo: rótulo acima de cada campo (`Campo`) e os
 * campos em duas colunas quando o grupo tem espaço. Sem o preenchimento
 * automático do navegador, que ofereceria os dados da própria representante.
 */
import { Input } from '@/components/ui/input';
import { Campo } from './crm/ui';

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

type ContatoFieldsProps = {
  idPrefix: string;
  legenda: string;
  value: ContatoFormValue;
  onChange: (value: ContatoFormValue) => void;
  erro?: string | null;
  disabled?: boolean;
};

export function ContatoFields({
  idPrefix,
  legenda,
  value,
  onChange,
  erro,
  disabled,
}: ContatoFieldsProps) {
  function atualizar<K extends keyof ContatoFormValue>(campo: K, valor: ContatoFormValue[K]): void {
    onChange({ ...value, [campo]: valor });
  }

  return (
    <fieldset className="@container rounded-lg border p-3" disabled={disabled}>
      {/* Legenda flutuando dentro do quadro (e não sobre a borda) */}
      <legend className="float-left mb-3 text-sm font-semibold">{legenda}</legend>

      <div className="clear-both grid gap-3 @md:grid-cols-2">
        <Campo rotulo="Nome" htmlFor={`${idPrefix}-nome`}>
          <Input
            type="text"
            id={`${idPrefix}-nome`}
            autoComplete="off"
            value={value.nome}
            onChange={(event) => atualizar('nome', event.target.value)}
          />
        </Campo>

        <Campo rotulo="Cargo" htmlFor={`${idPrefix}-cargo`}>
          <Input
            type="text"
            id={`${idPrefix}-cargo`}
            autoComplete="off"
            value={value.cargo}
            onChange={(event) => atualizar('cargo', event.target.value)}
          />
        </Campo>

        <Campo rotulo="Telefone" htmlFor={`${idPrefix}-telefone`}>
          <Input
            type="tel"
            id={`${idPrefix}-telefone`}
            autoComplete="off"
            value={value.telefone}
            onChange={(event) => atualizar('telefone', event.target.value)}
          />
        </Campo>

        <Campo rotulo="E-mail" htmlFor={`${idPrefix}-email`}>
          <Input
            type="email"
            id={`${idPrefix}-email`}
            autoComplete="off"
            value={value.email}
            onChange={(event) => atualizar('email', event.target.value)}
          />
        </Campo>
      </div>

      <label className="mt-3 flex w-fit items-center gap-2 text-sm max-md:min-h-11" htmlFor={`${idPrefix}-principal`}>
        <input
          type="checkbox"
          id={`${idPrefix}-principal`}
          className="size-4 accent-primary"
          checked={value.principal}
          onChange={(event) => atualizar('principal', event.target.checked)}
        />
        Contato principal
      </label>

      {erro && (
        <p className="mt-2 text-sm font-medium text-destructive" role="alert">
          {erro}
        </p>
      )}
    </fieldset>
  );
}

export default ContatoFields;
