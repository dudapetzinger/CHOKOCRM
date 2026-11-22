import { type ReactNode, type Ref } from 'react';
import { Camera, Paperclip } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type Props = {
  /** O mesmo `id` do rótulo (`htmlFor`) que nomeia o campo para o leitor de tela. */
  id: string;
  /** Texto do botão: "Anexar arquivo", "Anexar arquivos" ou "Anexar foto". */
  rotuloDoBotao: string;
  /** Texto ao lado do botão quando nada foi escolhido. */
  semArquivo: string;
  /** Arquivos escolhidos, para mostrar o nome ou a contagem. */
  arquivos: File[];
  onChange: (arquivos: File[]) => void;
  accept?: string;
  capture?: 'user' | 'environment';
  multiple?: boolean;
  required?: boolean;
  disabled?: boolean;
  icone?: 'clipe' | 'camera';
  /** Ação ao lado do botão, na mesma linha (por exemplo "Ler notas"). */
  acao?: ReactNode;
  className?: string;
  ref?: Ref<HTMLInputElement>;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
};

/**
 * Campo de arquivo com os textos do app (o do navegador sai no idioma dele e não
 * muda). O campo nativo cobre o botão com opacidade zero: tocar no botão abre a
 * escolha de arquivos, o teclado e o leitor de tela chegam ao campo, que o
 * rótulo externo (`htmlFor`) nomeia, e o anel de foco aparece no botão.
 */
export function CampoDeArquivo({
  id,
  rotuloDoBotao,
  semArquivo,
  arquivos,
  onChange,
  accept,
  capture,
  multiple,
  required,
  disabled,
  icone = 'clipe',
  acao,
  className,
  ref,
  ...aria
}: Readonly<Props>) {
  const Icone = icone === 'camera' ? Camera : Paperclip;
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-2', className)}>
      <div className="relative flex max-sm:w-full">
        <input
          {...aria}
          ref={ref}
          id={id}
          // Sem `title`, o navegador mostra o texto nativo dele ("Nenhum ficheiro selecionado") ao passar o mouse.
          title=""
          type="file"
          accept={accept}
          capture={capture}
          multiple={multiple}
          required={required}
          disabled={disabled}
          className="peer absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
          onChange={(evento) => onChange(Array.from(evento.target.files ?? []))}
        />
        <Button
          asChild
          variant="outline"
          className="pointer-events-none w-full peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-disabled:opacity-50"
        >
          <span aria-hidden="true">
            <Icone aria-hidden="true" />
            {rotuloDoBotao}
          </span>
        </Button>
      </div>
      {acao}
      <div className="min-w-0 flex-1 basis-40 text-sm text-muted-foreground">
        {arquivos.length === 0 && <p>{semArquivo}</p>}
        {arquivos.length === 1 && <p className="break-all">{arquivos[0].name}</p>}
        {arquivos.length > 1 && <p>{arquivos.length} arquivos selecionados</p>}
      </div>
      {arquivos.length > 1 && (
        // A lista tem altura máxima e rolagem própria: muitos PDFs não esticam a página.
        <ul className="max-h-48 basis-full space-y-0.5 overflow-y-auto text-sm text-muted-foreground">
          {arquivos.map((arquivo, indice) => (
            <li key={`${arquivo.name}-${indice}`} className="break-all">
              {arquivo.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
