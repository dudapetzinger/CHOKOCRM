/**
 * Cadastro de usuário pelo gestor (Etapa 8, spec 7.13), no visual de
 * `routes/usuarios.novo.tsx` do protótipo: um cartão de 560 px com nome,
 * e-mail, telefone, papel (representante por padrão), senha inicial e
 * confirmação. Validações do backend repetidas aqui (nome, e-mail, senha de
 * 6 caracteres) mais a confirmação, que não vai para a API. Sucesso: aviso
 * "Usuário criado" e a lista de usuários. Os campos não usam o
 * preenchimento automático do navegador: os dados são da pessoa nova, não
 * do gestor.
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '../auth/useAuth';
import type { Role } from '../auth/auth-context';
import { AvisoExclusivoDoGestor } from '../components/AvisoExclusivoDoGestor';
import { Segmentado } from '../components/Segmentado';
import { Aviso, Campo, Cartao } from '../components/crm/ui';
import { OPCOES_PAPEL } from '../lib/papel';
import { validarNovaSenha } from '../lib/senha';
import { useFocoNoPrimeiroErro } from '../lib/useFoco';
import { ApiError } from '../services/api';
import { mensagemErroApi } from '../services/clients';
import { criarUsuario, validarDadosUsuario, type NovoUsuarioInput } from '../services/users';

const MENSAGEM_ERRO_PADRAO = 'Não foi possível criar o usuário. Tente novamente.';

type Dados = { nome: string; email: string; telefone: string; senha: string; confirmacao: string };
type Erros = Partial<Record<Exclude<keyof Dados, 'telefone'>, string>>;

export function NovoUsuarioPage() {
  const { user } = useAuth();

  if (user?.role !== 'GESTOR') {
    return <AvisoExclusivoDoGestor />;
  }

  return <FormularioNovoUsuario />;
}

function FormularioNovoUsuario() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dados, setDados] = useState<Dados>({ nome: '', email: '', telefone: '', senha: '', confirmacao: '' });
  const [papel, setPapel] = useState<Role>('REPRESENTANTE');
  const [erros, setErros] = useState<Erros>({});
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const { ref: formulario, focarPrimeiroErro } = useFocoNoPrimeiroErro<HTMLFormElement>();

  const criar = useMutation({
    mutationFn: (input: NovoUsuarioInput) => criarUsuario(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      // Representante novo aparece no seletor do gestor
      void queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário criado');
      navigate('/usuarios', { replace: true });
    },
    onError: (erro) => {
      if (erro instanceof ApiError && erro.code === 'CONFLICT') {
        setErros({ email: erro.message });
        focarPrimeiroErro();
        return;
      }
      setErroEnvio(mensagemErroApi(erro, MENSAGEM_ERRO_PADRAO));
    },
  });

  /** Atualiza um campo e apaga o erro dele. */
  function atualizar(campo: keyof Dados, valor: string): void {
    setDados((anteriores) => ({ ...anteriores, [campo]: valor }));
    setErros((anteriores) => ({ ...anteriores, [campo]: undefined }));
  }

  function enviar(evento: FormEvent<HTMLFormElement>): void {
    evento.preventDefault();
    if (criar.isPending) return;
    setErroEnvio(null);

    const errosAtuais: Erros = {
      ...validarDadosUsuario(dados),
      ...validarNovaSenha(dados.senha, dados.confirmacao),
    };
    setErros(errosAtuais);
    if (Object.keys(errosAtuais).length > 0) {
      focarPrimeiroErro();
      return;
    }

    const telefone = dados.telefone.trim();
    criar.mutate({
      nome: dados.nome.trim(),
      email: dados.email.trim(),
      ...(telefone ? { telefone } : {}),
      role: papel,
      senha: dados.senha,
    });
  }

  return (
    <Cartao className="mx-auto max-w-[560px]">
      <form ref={formulario} onSubmit={enviar} noValidate autoComplete="off" className="space-y-4">
        <Campo rotulo="Nome" htmlFor="nome" erro={erros.nome}>
          <Input
            id="nome"
            autoComplete="off"
            value={dados.nome}
            onChange={(evento) => atualizar('nome', evento.target.value)}
          />
        </Campo>
        <Campo rotulo="E-mail" htmlFor="email" erro={erros.email}>
          <Input
            id="email"
            type="email"
            autoComplete="off"
            value={dados.email}
            onChange={(evento) => atualizar('email', evento.target.value)}
          />
        </Campo>
        <Campo rotulo="Telefone" htmlFor="telefone">
          <Input
            id="telefone"
            type="tel"
            autoComplete="off"
            value={dados.telefone}
            onChange={(evento) => atualizar('telefone', evento.target.value)}
          />
        </Campo>
        <div className="space-y-1.5">
          {/* O grupo já se chama "Papel"; o rótulo visível não é lido de novo */}
          <span aria-hidden="true" className="block text-sm font-medium">
            Papel
          </span>
          <Segmentado ariaLabel="Papel" opcoes={OPCOES_PAPEL} valor={papel} onChange={setPapel} />
        </div>
        <Campo
          rotulo="Senha inicial"
          htmlFor="senha"
          ajuda="Pelo menos 6 caracteres. A pessoa pode trocá-la depois em Alterar senha."
          erro={erros.senha}
        >
          <Input
            id="senha"
            type="password"
            autoComplete="new-password"
            value={dados.senha}
            onChange={(evento) => atualizar('senha', evento.target.value)}
          />
        </Campo>
        <Campo rotulo="Confirmação" htmlFor="confirmacao" erro={erros.confirmacao}>
          <Input
            id="confirmacao"
            type="password"
            autoComplete="new-password"
            value={dados.confirmacao}
            onChange={(evento) => atualizar('confirmacao', evento.target.value)}
          />
        </Campo>

        {erroEnvio && (
          <Aviso tom="erro" role="alert">
            {erroEnvio}
          </Aviso>
        )}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="submit" className="w-full sm:w-auto" disabled={criar.isPending}>
            {criar.isPending ? 'Criando...' : 'Criar usuário'}
          </Button>
          <Button type="button" variant="ghost" onClick={() => navigate('/usuarios')}>
            Cancelar
          </Button>
        </div>
      </form>
    </Cartao>
  );
}

export default NovoUsuarioPage;
