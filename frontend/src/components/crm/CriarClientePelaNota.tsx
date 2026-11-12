/**
 * "Criar cliente" de um CNPJ sem cliente no CRM ("cliente pela nota"), na
 * página "Importar notas" do gestor: no bloco "CNPJs sem cliente no CRM" e no
 * fecho da importação (`ImportacaoConcluida`, dentro do diálogo). O botão
 * abre, no próprio item, um formulário curto: "Representante" (obrigatório, entre os ativos),
 * "Nome fantasia" (vem com a razão social da nota) e "Recorrência (dias)"
 * (15). O resto do cadastro (endereço, cidade, telefone) vem da nota, no
 * backend; o cliente nasce sem e-mail e sem contatos, que o representante
 * completa na ficha.
 *
 * Ao salvar: toast "Cliente criado na carteira de <representante>" e tudo do
 * ERP (`['erp']`, incluindo a lista de CNPJs sem cliente, de onde o item
 * some), a ficha (`['client']`) e a lista de clientes (`['clients']`) são
 * buscados de novo. Erro da API (CNPJ já cadastrado, representante inválido)
 * aparece no formulário, que continua aberto. O foco vai para "Representante"
 * ao abrir e volta a "Criar cliente" em "Cancelar".
 *
 * Só usa o CNPJ e a razão social do item (`Pick<CnpjSemCliente, …>`), o que
 * deixa o fecho da importação montá-lo a partir da nota gravada.
 * `abertoDeInicio`: o formulário já vem aberto (o fecho da importação), sem
 * mexer no foco; "Cancelar" mostra o botão "Criar cliente" e leva o foco a ele.
 * `aoCriar(cliente)`: chamado depois do sucesso (com o toast e as buscas de
 * novo já disparados), com o id e o nome fantasia do cliente criado.
 * `children` são outras ações do item, que ficam ao lado de "Criar cliente" e
 * continuam visíveis com o formulário aberto.
 */
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useRepresentantes } from '../../hooks/useRepresentantes';
import { useDevolverFoco, useFocoNoPrimeiroErro } from '../../lib/useFoco';
import { mensagemErroApi } from '../../services/clients';
import { criarClientePelaNota, type CnpjSemCliente, type DadosClientePelaNota } from '../../services/importacoes';
import { Aviso, Campo, CLASSES_SELECT } from './ui';

const RECORRENCIA_PADRAO = '15';
const MENSAGEM_ERRO_CRIAR = 'Não foi possível criar o cliente.';

type Erros = Partial<Record<'representanteId' | 'nomeFantasia' | 'recorrenciaDias', string>>;

function validar(representanteId: string, nomeFantasia: string, recorrenciaDias: string): Erros {
  const erros: Erros = {};
  if (!representanteId) erros.representanteId = 'Escolha o representante.';
  if (!nomeFantasia.trim()) erros.nomeFantasia = 'Nome fantasia é obrigatório.';
  const recorrencia = Number(recorrenciaDias);
  if (!Number.isInteger(recorrencia) || recorrencia < 1 || recorrencia > 365) {
    erros.recorrenciaDias = 'Recorrência de visitas deve ser um número inteiro entre 1 e 365.';
  }
  return erros;
}

/** O que o formulário usa do CNPJ sem cliente. */
type ItemSemCliente = Pick<CnpjSemCliente, 'cnpj' | 'razaoSocial'>;

/** O cliente que acabou de ser criado, para quem usa o formulário mostrar o caminho até ele. */
export type ClienteCriado = { id: string; nomeFantasia: string };

type Props = {
  item: ItemSemCliente;
  abertoDeInicio?: boolean;
  aoCriar?: (cliente: ClienteCriado) => void;
  children?: ReactNode;
};

export function CriarClientePelaNota({ item, abertoDeInicio = false, aoCriar, children }: Props) {
  const [aberto, setAberto] = useState(abertoDeInicio);
  // O foco vai para "Representante" só quando o próprio gestor abre o formulário.
  const [focarAoAbrir, setFocarAoAbrir] = useState(false);
  const { ref: botaoCriar, devolverFoco } = useDevolverFoco<HTMLButtonElement>(aberto);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {!aberto && (
          <Button
            ref={botaoCriar}
            type="button"
            size="sm"
            onClick={() => {
              setFocarAoAbrir(true);
              setAberto(true);
            }}
          >
            Criar cliente
          </Button>
        )}
        {children}
      </div>
      {aberto && (
        <Formulario
          item={item}
          focarAoAbrir={focarAoAbrir}
          aoCriar={aoCriar}
          aoFechar={() => {
            devolverFoco();
            setAberto(false);
          }}
        />
      )}
    </div>
  );
}

function Formulario({
  item,
  focarAoAbrir,
  aoCriar,
  aoFechar,
}: {
  item: ItemSemCliente;
  focarAoAbrir: boolean;
  aoCriar?: (cliente: ClienteCriado) => void;
  aoFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const prefixo = useId();
  const { data: representantes = [] } = useRepresentantes();
  const [representanteId, setRepresentanteId] = useState('');
  const [nomeFantasia, setNomeFantasia] = useState(item.razaoSocial);
  const [recorrenciaDias, setRecorrenciaDias] = useState(RECORRENCIA_PADRAO);
  const [erros, setErros] = useState<Erros>({});
  const { ref: formulario, focarPrimeiroErro } = useFocoNoPrimeiroErro<HTMLFormElement>();
  const seletor = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (focarAoAbrir) seletor.current?.focus();
  }, [focarAoAbrir]);

  const criar = useMutation({
    mutationFn: (dados: DadosClientePelaNota) => criarClientePelaNota(item.cnpj, dados),
    onSuccess: (cliente) => {
      toast.success(`Cliente criado na carteira de ${cliente.representante.nome}`);
      const buscasDeNovo = Promise.all([
        queryClient.invalidateQueries({ queryKey: ['erp'] }),
        queryClient.invalidateQueries({ queryKey: ['client'] }),
        queryClient.invalidateQueries({ queryKey: ['clients'] }),
      ]);
      // Depois de disparar as buscas: quem usa pode tirar o formulário da tela.
      aoCriar?.({ id: cliente.id, nomeFantasia: cliente.nomeFantasia });
      return buscasDeNovo;
    },
  });

  function salvar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    const novosErros = validar(representanteId, nomeFantasia, recorrenciaDias);
    setErros(novosErros);
    if (Object.keys(novosErros).length > 0) {
      focarPrimeiroErro();
      return;
    }
    criar.mutate({ representanteId, nomeFantasia: nomeFantasia.trim(), recorrenciaDias: Number(recorrenciaDias) });
  }

  return (
    <form ref={formulario} onSubmit={salvar} noValidate className="space-y-3 rounded-lg border p-3">
      {criar.isError && (
        <Aviso tom="erro" role="alert">
          {mensagemErroApi(criar.error, MENSAGEM_ERRO_CRIAR)}
        </Aviso>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <Campo rotulo="Representante" htmlFor={`${prefixo}-representante`} erro={erros.representanteId}>
          <select
            ref={seletor}
            id={`${prefixo}-representante`}
            className={cn(CLASSES_SELECT, 'w-full')}
            value={representanteId}
            onChange={(evento) => {
              setRepresentanteId(evento.target.value);
              setErros((atuais) => ({ ...atuais, representanteId: undefined }));
            }}
          >
            <option value="">Escolha...</option>
            {representantes.map((representante) => (
              <option key={representante.id} value={representante.id}>
                {representante.nome}
              </option>
            ))}
          </select>
        </Campo>
        <Campo rotulo="Nome fantasia" htmlFor={`${prefixo}-nome-fantasia`} erro={erros.nomeFantasia}>
          <Input
            id={`${prefixo}-nome-fantasia`}
            value={nomeFantasia}
            onChange={(evento) => {
              setNomeFantasia(evento.target.value);
              setErros((atuais) => ({ ...atuais, nomeFantasia: undefined }));
            }}
          />
        </Campo>
        <Campo rotulo="Recorrência (dias)" htmlFor={`${prefixo}-recorrencia`} erro={erros.recorrenciaDias}>
          <Input
            id={`${prefixo}-recorrencia`}
            type="number"
            inputMode="numeric"
            min={1}
            max={365}
            value={recorrenciaDias}
            onChange={(evento) => {
              setRecorrenciaDias(evento.target.value);
              setErros((atuais) => ({ ...atuais, recorrenciaDias: undefined }));
            }}
          />
        </Campo>
      </div>
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
        <Button type="button" size="sm" variant="outline" onClick={aoFechar} disabled={criar.isPending}>
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={criar.isPending}>
          {criar.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
      </div>
    </form>
  );
}
