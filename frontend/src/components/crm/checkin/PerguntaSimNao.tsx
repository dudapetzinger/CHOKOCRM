/**
 * Pergunta de sim ou não do passo "Próximos passos" do check-in (Etapa 10b):
 * um `fieldset` com a pergunta na legenda e o `Segmentado` "Não | Sim" na
 * largura toda no celular. Com "Sim", os campos (`children`) aparecem logo
 * abaixo, dentro do mesmo grupo.
 */
import type { ReactNode } from 'react';
import { Segmentado, type Opcao } from '../../Segmentado';

type SimNao = 'nao' | 'sim';

const OPCOES: readonly Opcao<SimNao>[] = [
  { valor: 'nao', rotulo: 'Não' },
  { valor: 'sim', rotulo: 'Sim' },
];

export function PerguntaSimNao({
  id,
  pergunta,
  valor,
  onChange,
  children,
}: {
  id: string;
  pergunta: string;
  valor: boolean;
  onChange: (sim: boolean) => void;
  children?: ReactNode;
}) {
  return (
    <fieldset id={id} className="min-w-0 space-y-3">
      <legend className="mb-1.5 text-sm font-medium">{pergunta}</legend>
      <Segmentado
        ariaLabel={pergunta}
        opcoes={OPCOES}
        valor={valor ? 'sim' : 'nao'}
        onChange={(escolha) => onChange(escolha === 'sim')}
        larguraTotal
      />
      {valor && children}
    </fieldset>
  );
}
