/**
 * Contato novo em linha (`NovoContato` do protótipo, spec 7.3): nome, cargo,
 * telefone e e-mail, todos obrigatórios como em `contact.schema.ts` do
 * backend, e "Tornar principal" (o backend rebaixa o principal anterior).
 * Grava com `POST /clients/:id/contacts` e atualiza a ficha e a lista.
 *
 * Abre na ficha ("Adicionar contato") e, a partir da tarefa do check-in,
 * dentro do formulário do check-in: por isso não é um `<form>` (formulário
 * dentro de formulário não vale em HTML). Os botões são `type="button"` e
 * Enter num campo adiciona o contato em vez de enviar o formulário em volta.
 *
 * `aoConcluir(contato)` depois de gravar; `aoConcluir()` ao cancelar.
 */
import { useId, useState, type KeyboardEvent } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createContato, mensagemErroApi, type Contato, type ContatoInput } from '../../services/clients';
import { Campo } from './ui';

const MENSAGEM_ERRO_SALVAR = 'Não foi possível salvar o contato.';
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type CampoTexto = 'nome' | 'cargo' | 'telefone' | 'email';
type Erros = Partial<Record<CampoTexto, string>>;

/** Mesmas regras e mensagens do `createContactSchema` (zod) do backend. */
function validar(contato: ContatoInput): Erros {
  const erros: Erros = {};
  if (!contato.nome.trim()) erros.nome = 'Nome do contato é obrigatório.';
  if (!contato.cargo.trim()) erros.cargo = 'Cargo do contato é obrigatório.';
  if (!contato.telefone.trim()) erros.telefone = 'Telefone do contato é obrigatório.';
  if (!contato.email.trim()) erros.email = 'E-mail do contato é obrigatório.';
  else if (!EMAIL_REGEX.test(contato.email.trim())) erros.email = 'E-mail do contato inválido.';
  return erros;
}

const CAMPOS: { campo: CampoTexto; rotulo: string; tipo: string; autoComplete: string }[] = [
  { campo: 'nome', rotulo: 'Nome', tipo: 'text', autoComplete: 'name' },
  { campo: 'cargo', rotulo: 'Cargo', tipo: 'text', autoComplete: 'organization-title' },
  { campo: 'telefone', rotulo: 'Telefone', tipo: 'tel', autoComplete: 'tel' },
  { campo: 'email', rotulo: 'E-mail', tipo: 'email', autoComplete: 'email' },
];

type Props = {
  clienteId: string;
  aoConcluir: (contato?: Contato) => void;
};

export function NovoContato({ clienteId, aoConcluir }: Props) {
  const id = useId();
  const queryClient = useQueryClient();
  const [contato, setContato] = useState<ContatoInput>({
    nome: '',
    cargo: '',
    telefone: '',
    email: '',
    principal: false,
  });
  const [erros, setErros] = useState<Erros>({});

  const mutation = useMutation({
    mutationFn: (dados: ContatoInput) => createContato(clienteId, dados),
    onSuccess: (criado) => {
      queryClient.invalidateQueries({ queryKey: ['client', clienteId] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Contato adicionado');
      aoConcluir(criado);
    },
  });

  function adicionar(): void {
    if (mutation.isPending) return;
    const encontrados = validar(contato);
    setErros(encontrados);
    if (Object.keys(encontrados).length > 0) return;

    mutation.mutate({
      nome: contato.nome.trim(),
      cargo: contato.cargo.trim(),
      telefone: contato.telefone.trim(),
      email: contato.email.trim(),
      principal: contato.principal,
    });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Enter' && event.target instanceof HTMLInputElement && event.target.type !== 'checkbox') {
      event.preventDefault();
      adicionar();
    }
  }

  return (
    <div
      role="group"
      aria-label="Novo contato"
      className="@container space-y-3 rounded-lg border bg-card p-3"
      onKeyDown={handleKeyDown}
    >
      {mutation.isError && (
        <p className="text-sm font-medium text-destructive" role="alert">
          {mensagemErroApi(mutation.error, MENSAGEM_ERRO_SALVAR)}
        </p>
      )}

      <div className="grid gap-3 @md:grid-cols-2">
        {CAMPOS.map(({ campo, rotulo, tipo, autoComplete }) => (
          <Campo key={campo} rotulo={rotulo} htmlFor={`${id}-${campo}`} erro={erros[campo]}>
            <Input
              id={`${id}-${campo}`}
              type={tipo}
              autoComplete={autoComplete}
              value={contato[campo]}
              onChange={(event) => {
                setContato((anterior) => ({ ...anterior, [campo]: event.target.value }));
                setErros((anteriores) => ({ ...anteriores, [campo]: undefined }));
              }}
            />
          </Campo>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="mr-auto flex items-center gap-2 text-sm max-md:min-h-11">
          <input
            type="checkbox"
            className="size-4 accent-primary"
            checked={contato.principal}
            onChange={(event) => setContato((anterior) => ({ ...anterior, principal: event.target.checked }))}
          />
          Tornar principal
        </label>
        <Button type="button" size="sm" onClick={adicionar} disabled={mutation.isPending}>
          {mutation.isPending ? 'Adicionando...' : 'Adicionar'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => aoConcluir()} disabled={mutation.isPending}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
