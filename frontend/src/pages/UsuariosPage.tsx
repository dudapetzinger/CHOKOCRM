/**
 * Gestão de usuários do gestor (Etapa 8, spec 7.13), no visual de
 * `routes/usuarios.tsx` do protótipo: "Novo usuário" e a lista de todos os
 * usuários, ativos e inativos. Cada linha tem avatar, nome, "e-mail ·
 * telefone", o papel, a situação, "N clientes" e o menu de ações:
 *   - Editar dados: nome, e-mail, telefone e — para os outros — o papel;
 *   - Transferir carteira (representante com clientes): para um
 *     representante ativo;
 *   - Redefinir senha: o link vai ao e-mail de cadastro da pessoa;
 *   - Inativar (com confirmação, podendo transferir a carteira antes) ou
 *     Reativar. Na própria linha, "Inativar" fica desabilitado.
 * As ações abrem um painel abaixo da linha, um de cada vez; o foco vai para
 * o painel e volta ao botão de ações quando ele fecha. No celular a linha
 * quebra em dois andares (avatar e nome em cima; etiquetas, carteira e menu
 * embaixo, spec 8). As regras valem no backend; as mensagens dele aparecem
 * como vêm.
 */
import { useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, KeyRound, MoreHorizontal, Pencil, Plus, UserCheck, UserX } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useAuth } from '../auth/useAuth';
import type { Role } from '../auth/auth-context';
import { AvisoExclusivoDoGestor } from '../components/AvisoExclusivoDoGestor';
import { Segmentado } from '../components/Segmentado';
import { Aviso, Avatar, Campo, CLASSES_SELECT, Etiqueta } from '../components/crm/ui';
import { useUsuarios } from '../hooks/useUsuarios';
import { descreverClientes } from '../lib/descreverClientesAtivos';
import { OPCOES_PAPEL, ROTULO_PAPEL } from '../lib/papel';
import { primeiroNome } from '../lib/primeiroNome';
import { useFocoNoPrimeiroErro } from '../lib/useFoco';
import { ApiError } from '../services/api';
import { mensagemErroApi } from '../services/clients';
import {
  atualizarUsuario,
  enviarRedefinicaoDeSenha,
  transferirCarteira,
  validarDadosUsuario,
  type AtualizarUsuarioInput,
  type ErrosDadosUsuario,
  type Usuario,
} from '../services/users';

const MENSAGEM_ERRO_CARREGAR = 'Não foi possível carregar os usuários.';
const MENSAGEM_ERRO_SALVAR = 'Não foi possível salvar os dados. Tente novamente.';
const MENSAGEM_ERRO_TRANSFERIR = 'Não foi possível transferir a carteira. Tente novamente.';
const MENSAGEM_ERRO_INATIVAR = 'Não foi possível inativar o usuário. Tente novamente.';
const MENSAGEM_ERRO_REATIVAR = 'Não foi possível reativar o usuário. Tente novamente.';
const MENSAGEM_ERRO_REDEFINIR = 'Não foi possível enviar o link de redefinição. Tente novamente.';

type TipoDePainel = 'editar' | 'transferir' | 'inativar';

/** Contagens e listas de usuários (tela de Usuários e seletor de representante). */
const CHAVES_DOS_USUARIOS = [['usuarios'], ['users']];
/** Tudo que mostra a carteira ou o nome do representante: listas, ficha, agenda, painel e alertas. */
const CHAVES_DAS_CARTEIRAS = [['clients'], ['client'], ['agenda'], ['dashboard'], ['insights']];

function invalidar(queryClient: QueryClient, chaves: string[][]): void {
  for (const queryKey of chaves) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

/** "5 clientes transferidos", "1 cliente transferido". */
function avisoDeTransferidos(transferidos: number): string {
  return `${descreverClientes(transferidos)} ${transferidos === 1 ? 'transferido' : 'transferidos'}`;
}

/** A confirmação de inativar lembra que a carteira fica com a pessoa até ser transferida. */
function fraseDeInativar(usuario: Usuario): string {
  const nome = primeiroNome(usuario.nome);
  const total = usuario.clientesNaCarteira;
  if (total === 0) return `Inativar a conta de ${nome}?`;
  if (total === 1) return `${nome} tem 1 cliente na carteira; ele continua na carteira até você transferi-lo. Inativar?`;
  return `${nome} tem ${total} clientes na carteira; eles continuam na carteira até você transferi-los. Inativar?`;
}

export function UsuariosPage() {
  const { user } = useAuth();

  if (user?.role !== 'GESTOR') {
    return <AvisoExclusivoDoGestor />;
  }

  return <ListaDeUsuarios gestorId={user.id} />;
}

function ListaDeUsuarios({ gestorId }: { gestorId: string }) {
  const { data: usuarios, isLoading, isError, error } = useUsuarios();
  const [painel, setPainel] = useState<{ tipo: TipoDePainel; id: string } | null>(null);

  return (
    <div className="space-y-4">
      <Button asChild className="max-sm:w-full">
        <Link to="/usuarios/novo">
          <Plus aria-hidden="true" />
          Novo usuário
        </Link>
      </Button>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando usuários...</p>}
      {isError && (
        <Aviso tom="erro" role="alert">
          {mensagemErroApi(error, MENSAGEM_ERRO_CARREGAR)}
        </Aviso>
      )}

      {usuarios && (
        <ul aria-label="Usuários" className="divide-y rounded-xl border bg-card">
          {usuarios.map((usuario) => (
            <LinhaUsuario
              key={usuario.id}
              usuario={usuario}
              ehAPropriaConta={usuario.id === gestorId}
              // Destinos da carteira: representantes ativos, menos o próprio dono
              destinos={usuarios.filter(
                (outro) => outro.role === 'REPRESENTANTE' && outro.ativo && outro.id !== usuario.id,
              )}
              painelAberto={painel?.id === usuario.id ? painel.tipo : null}
              abrirPainel={(tipo) => setPainel({ tipo, id: usuario.id })}
              fecharPainel={() => setPainel(null)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

type PropsDaLinha = {
  usuario: Usuario;
  ehAPropriaConta: boolean;
  destinos: Usuario[];
  painelAberto: TipoDePainel | null;
  abrirPainel: (tipo: TipoDePainel) => void;
  fecharPainel: () => void;
};

function LinhaUsuario({ usuario, ehAPropriaConta, destinos, painelAberto, abrirPainel, fecharPainel }: PropsDaLinha) {
  const queryClient = useQueryClient();
  const linha = useRef<HTMLLIElement>(null);
  const gatilho = useRef<HTMLButtonElement>(null);
  // Item do menu que abre um painel: o foco vai para o painel, não volta ao botão de ações.
  const abrindoPainel = useRef(false);

  const reativar = useMutation({
    mutationFn: () => atualizarUsuario(usuario.id, { ativo: true }),
    onSuccess: () => {
      invalidar(queryClient, CHAVES_DOS_USUARIOS);
      toast.success('Usuário reativado');
    },
    onError: (erro) => toast.error(mensagemErroApi(erro, MENSAGEM_ERRO_REATIVAR)),
  });

  const redefinirSenha = useMutation({
    mutationFn: () => enviarRedefinicaoDeSenha(usuario.id),
    onSuccess: () => toast.success(`Link de redefinição enviado para ${usuario.email}`),
    onError: (erro) => toast.error(mensagemErroApi(erro, MENSAGEM_ERRO_REDEFINIR)),
  });

  function abrir(tipo: TipoDePainel): void {
    abrindoPainel.current = true;
    abrirPainel(tipo);
  }

  /** Fecha o painel e devolve o foco ao botão de ações da linha. */
  function fechar(): void {
    gatilho.current?.focus();
    fecharPainel();
  }

  const podeTransferir = usuario.role === 'REPRESENTANTE' && usuario.clientesNaCarteira > 0;
  // O telefone não quebra no meio ("(47)" numa linha e o número na outra)
  const contato = usuario.telefone
    ? `${usuario.email} · ${usuario.telefone.replace(/ /g, '\u00a0')}`
    : usuario.email;

  return (
    // A linha é um contêiner: numa linha só a partir de 36rem de largura útil
    // (desktop); abaixo disso (celular e tablet, com o menu lateral de 768 px)
    // em dois andares, para o nome e o e-mail não ficarem espremidos.
    <li ref={linha} className="@container p-4">
      <div className="flex flex-col gap-2 @xl:flex-row @xl:items-center @xl:gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Avatar nome={usuario.nome} />
          <div className="min-w-0">
            <div className="font-semibold wrap-break-word">{usuario.nome}</div>
            <div className="text-sm text-muted-foreground wrap-anywhere">{contato}</div>
          </div>
        </div>
        {/* Segundo andar: etiquetas e carteira (quebram entre si, se faltar
            espaço) e o menu sempre à direita, na mesma faixa. Com espaço,
            alinhado ao nome (avatar de 40 px + 12 de espaço). */}
        <div className="flex items-center gap-2 @sm:pl-13 @xl:pl-0">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 @xl:flex-none">
            <Etiqueta>{ROTULO_PAPEL[usuario.role]}</Etiqueta>
            <Etiqueta tom={usuario.ativo ? 'verde' : 'neutro'}>{usuario.ativo ? 'Ativo' : 'Inativo'}</Etiqueta>
            <span className="text-sm text-muted-foreground @xl:w-20 @xl:text-right">
              {descreverClientes(usuario.clientesNaCarteira)}
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button ref={gatilho} variant="ghost" size="icon" className="shrink-0" aria-label={`Ações de ${usuario.nome}`}>
                <MoreHorizontal aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              // O foco vai ao controle marcado com `data-foco-inicial` no painel
              // que abriu. Só aqui: antes disso o menu ainda prende o foco nele.
              onCloseAutoFocus={(evento) => {
                if (!abrindoPainel.current) return;
                abrindoPainel.current = false;
                evento.preventDefault();
                linha.current?.querySelector<HTMLElement>('[data-foco-inicial]')?.focus();
              }}
            >
              <DropdownMenuItem onSelect={() => abrir('editar')}>
                <Pencil aria-hidden="true" />
                Editar dados
              </DropdownMenuItem>
              {podeTransferir && (
                <DropdownMenuItem onSelect={() => abrir('transferir')}>
                  <ArrowRightLeft aria-hidden="true" />
                  Transferir carteira
                </DropdownMenuItem>
              )}
              <DropdownMenuItem disabled={redefinirSenha.isPending} onSelect={() => redefinirSenha.mutate()}>
                <KeyRound aria-hidden="true" />
                Redefinir senha
              </DropdownMenuItem>
              {usuario.ativo ? (
                <DropdownMenuItem disabled={ehAPropriaConta} onSelect={() => abrir('inativar')}>
                  <UserX aria-hidden="true" />
                  Inativar
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem disabled={reativar.isPending} onSelect={() => reativar.mutate()}>
                  <UserCheck aria-hidden="true" />
                  Reativar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {painelAberto === 'editar' && (
        <PainelEditar usuario={usuario} ehAPropriaConta={ehAPropriaConta} aoFechar={fechar} />
      )}
      {painelAberto === 'transferir' && <PainelTransferir usuario={usuario} destinos={destinos} aoFechar={fechar} />}
      {painelAberto === 'inativar' && <PainelInativar usuario={usuario} destinos={destinos} aoFechar={fechar} />}
    </li>
  );
}

type CamposEditaveis = { nome: string; email: string; telefone: string };

function PainelEditar({
  usuario,
  ehAPropriaConta,
  aoFechar,
}: {
  usuario: Usuario;
  ehAPropriaConta: boolean;
  aoFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const { recarregarUsuario } = useAuth();
  const [dados, setDados] = useState<CamposEditaveis>({
    nome: usuario.nome,
    email: usuario.email,
    telefone: usuario.telefone ?? '',
  });
  const [papel, setPapel] = useState<Role>(usuario.role);
  const [erros, setErros] = useState<ErrosDadosUsuario>({});
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const { ref: formulario, focarPrimeiroErro } = useFocoNoPrimeiroErro<HTMLFormElement>();
  const prefixo = `editar-${usuario.id}`;

  const salvar = useMutation({
    mutationFn: (input: AtualizarUsuarioInput) => atualizarUsuario(usuario.id, input),
    onSuccess: () => {
      // O nome aparece nas listas de clientes, na agenda e no painel
      invalidar(queryClient, [...CHAVES_DOS_USUARIOS, ...CHAVES_DAS_CARTEIRAS]);
      // Os próprios dados: o menu da conta mostra o nome novo
      if (ehAPropriaConta) void recarregarUsuario().catch(() => {});
      toast.success('Dados atualizados');
      aoFechar();
    },
    onError: (erro) => {
      if (erro instanceof ApiError && erro.code === 'CONFLICT') {
        setErros({ email: erro.message });
        focarPrimeiroErro();
        return;
      }
      setErroEnvio(mensagemErroApi(erro, MENSAGEM_ERRO_SALVAR));
    },
  });

  function atualizar(campo: keyof CamposEditaveis, valor: string): void {
    setDados((anteriores) => ({ ...anteriores, [campo]: valor }));
    if (campo !== 'telefone') setErros((anteriores) => ({ ...anteriores, [campo]: undefined }));
  }

  function enviar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    if (salvar.isPending) return;
    setErroEnvio(null);

    const errosAtuais = validarDadosUsuario(dados);
    setErros(errosAtuais);
    if (Object.keys(errosAtuais).length > 0) {
      focarPrimeiroErro();
      return;
    }

    salvar.mutate({
      nome: dados.nome.trim(),
      email: dados.email.trim(),
      telefone: dados.telefone.trim() || null,
      // Ninguém muda o próprio papel (o backend recusa)
      ...(ehAPropriaConta ? {} : { role: papel }),
    });
  }

  return (
    <form
      ref={formulario}
      aria-label={`Editar dados de ${usuario.nome}`}
      noValidate
      autoComplete="off"
      onSubmit={enviar}
      className="mt-3 grid gap-3 rounded-lg border bg-card p-4 @xl:grid-cols-3"
    >
      <Campo rotulo="Nome" htmlFor={`${prefixo}-nome`} erro={erros.nome}>
        <Input
          id={`${prefixo}-nome`}
          data-foco-inicial
          autoComplete="off"
          value={dados.nome}
          onChange={(evento) => atualizar('nome', evento.target.value)}
        />
      </Campo>
      <Campo rotulo="E-mail" htmlFor={`${prefixo}-email`} erro={erros.email}>
        <Input
          id={`${prefixo}-email`}
          type="email"
          autoComplete="off"
          value={dados.email}
          onChange={(evento) => atualizar('email', evento.target.value)}
        />
      </Campo>
      <Campo rotulo="Telefone" htmlFor={`${prefixo}-telefone`}>
        <Input
          id={`${prefixo}-telefone`}
          type="tel"
          autoComplete="off"
          value={dados.telefone}
          onChange={(evento) => atualizar('telefone', evento.target.value)}
        />
      </Campo>

      {erroEnvio && (
        <Aviso tom="erro" role="alert" className="@xl:col-span-3">
          {erroEnvio}
        </Aviso>
      )}

      <div className="flex flex-wrap items-end gap-2 @xl:col-span-3">
        {!ehAPropriaConta && (
          <div className="space-y-1.5 @max-xl:w-full">
            <span aria-hidden="true" className="block text-sm font-medium">
              Papel
            </span>
            <Segmentado ariaLabel="Papel" opcoes={OPCOES_PAPEL} valor={papel} onChange={setPapel} />
          </div>
        )}
        <span className="hidden flex-1 @xl:block" />
        <Button type="submit" size="sm" disabled={salvar.isPending}>
          {salvar.isPending ? 'Salvando...' : 'Salvar'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={aoFechar}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

/** Select de representante de destino, com o visual do protótipo e 44 px no celular. */
function SelectDeDestino({
  rotulo,
  valor,
  onChange,
  primeiraOpcao,
  destinos,
  rotuloDoDestino,
  focoInicial,
}: {
  rotulo: string;
  valor: string;
  onChange: (valor: string) => void;
  primeiraOpcao: string;
  destinos: Usuario[];
  rotuloDoDestino: (destino: Usuario) => string;
  focoInicial?: boolean;
}) {
  return (
    <select
      aria-label={rotulo}
      data-foco-inicial={focoInicial || undefined}
      className={cn(CLASSES_SELECT, 'min-w-0 @max-md:w-full')}
      value={valor}
      onChange={(evento) => onChange(evento.target.value)}
    >
      <option value="">{primeiraOpcao}</option>
      {destinos.map((destino) => (
        <option key={destino.id} value={destino.id}>
          {rotuloDoDestino(destino)}
        </option>
      ))}
    </select>
  );
}

function PainelTransferir({
  usuario,
  destinos,
  aoFechar,
}: {
  usuario: Usuario;
  destinos: Usuario[];
  aoFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const [destino, setDestino] = useState('');
  const nome = primeiroNome(usuario.nome);
  const total = usuario.clientesNaCarteira;

  const transferir = useMutation({
    mutationFn: (destinoId: string) => transferirCarteira(usuario.id, destinoId),
    onSuccess: ({ transferidos }) => {
      invalidar(queryClient, [['usuarios'], ...CHAVES_DAS_CARTEIRAS]);
      toast.success(avisoDeTransferidos(transferidos));
      aoFechar();
    },
  });

  return (
    <div
      role="group"
      aria-label={`Transferir carteira de ${usuario.nome}`}
      className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 text-sm"
    >
      {destinos.length > 0 ? (
        <>
          <span className="@max-md:basis-full @md:flex-1">
            {total === 1
              ? `Transferir o cliente de ${nome} para:`
              : `Transferir os ${total} clientes de ${nome} para:`}
          </span>
          <SelectDeDestino
            rotulo="Representante de destino"
            valor={destino}
            onChange={setDestino}
            primeiraOpcao="Escolha…"
            destinos={destinos}
            rotuloDoDestino={(representante) => representante.nome}
            focoInicial
          />
          <Button size="sm" disabled={!destino || transferir.isPending} onClick={() => transferir.mutate(destino)}>
            {transferir.isPending ? 'Transferindo...' : 'Transferir'}
          </Button>
        </>
      ) : (
        <span className="@max-md:basis-full @md:flex-1">Não há outro representante ativo para receber a carteira.</span>
      )}
      <Button size="sm" variant="ghost" data-foco-inicial={destinos.length === 0 || undefined} onClick={aoFechar}>
        Cancelar
      </Button>
      {transferir.isError && (
        <Aviso tom="erro" role="alert" className="basis-full">
          {mensagemErroApi(transferir.error, MENSAGEM_ERRO_TRANSFERIR)}
        </Aviso>
      )}
    </div>
  );
}

function PainelInativar({
  usuario,
  destinos,
  aoFechar,
}: {
  usuario: Usuario;
  destinos: Usuario[];
  aoFechar: () => void;
}) {
  const queryClient = useQueryClient();
  const [destino, setDestino] = useState('');
  const podeTransferir = usuario.clientesNaCarteira > 0 && destinos.length > 0;

  const inativar = useMutation({
    // Com destino escolhido, a carteira sai antes; se a inativação falhar
    // depois, a transferência já feita não se repete na nova tentativa.
    mutationFn: async (destinoId: string) => {
      if (destinoId) {
        const { transferidos } = await transferirCarteira(usuario.id, destinoId);
        setDestino('');
        invalidar(queryClient, CHAVES_DAS_CARTEIRAS);
        toast.success(avisoDeTransferidos(transferidos));
      }
      return atualizarUsuario(usuario.id, { ativo: false });
    },
    onSuccess: () => {
      invalidar(queryClient, CHAVES_DOS_USUARIOS);
      toast.success('Usuário inativado');
      aoFechar();
    },
    // A transferência pode ter ido e a inativação não: a lista recarrega a contagem
    onError: () => invalidar(queryClient, [['usuarios']]),
  });

  return (
    <div
      role="group"
      aria-label={`Inativar ${usuario.nome}`}
      className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-st-red-soft p-3 text-sm"
    >
      <span className="@max-md:basis-full @md:flex-1">{fraseDeInativar(usuario)}</span>
      {podeTransferir && (
        <SelectDeDestino
          rotulo="Transferir carteira para"
          valor={destino}
          onChange={setDestino}
          primeiraOpcao="Manter carteira"
          destinos={destinos}
          rotuloDoDestino={(representante) => `Transferir para ${primeiroNome(representante.nome)}`}
          focoInicial
        />
      )}
      <Button
        size="sm"
        variant="destructive"
        disabled={inativar.isPending}
        onClick={() => inativar.mutate(destino)}
      >
        {inativar.isPending ? 'Inativando...' : 'Inativar'}
      </Button>
      {/* Sem select, o foco começa em "Cancelar", nunca na ação que não se desfaz com um toque */}
      <Button size="sm" variant="ghost" data-foco-inicial={!podeTransferir || undefined} onClick={aoFechar}>
        Cancelar
      </Button>
      {inativar.isError && (
        <Aviso tom="erro" role="alert" className="basis-full">
          {mensagemErroApi(inativar.error, MENSAGEM_ERRO_INATIVAR)}
        </Aviso>
      )}
    </div>
  );
}

export default UsuariosPage;
