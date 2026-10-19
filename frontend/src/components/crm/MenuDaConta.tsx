import { startTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { KeyRound, LogOut } from 'lucide-react';
import { useAuth } from '@/auth/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ROTULO_PAPEL } from '@/lib/papel';
import { Avatar } from './ui';

/**
 * Menu da conta, à direita da barra superior (spec 6.5): as iniciais num
 * círculo de 36 px (alvo de 44 px no celular) abrem nome, papel, "Alterar
 * senha" e "Sair".
 */
export function MenuDaConta() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  // Sair e ir para o login na mesma transição: se o usuário nulo chegasse
  // antes da troca de rota, o RequireAuth guardaria a tela atual como
  // origem, e a próxima pessoa a entrar cairia na tela de quem saiu em vez
  // da tela inicial do próprio papel.
  function sair() {
    startTransition(() => {
      logout();
      navigate('/login', { replace: true });
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Conta de ${user.nome}`}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:size-9"
      >
        <Avatar nome={user.nome} tamanho={36} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="truncate">{user.nome}</div>
          <div className="text-xs font-normal text-muted-foreground">{ROTULO_PAPEL[user.role]}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => navigate('/conta/senha')}>
          <KeyRound aria-hidden="true" />
          Alterar senha
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={sair}>
          <LogOut aria-hidden="true" />
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
