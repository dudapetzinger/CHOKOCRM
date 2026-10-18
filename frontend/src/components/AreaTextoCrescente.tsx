/**
 * `<textarea>` que cresce com o conteúdo até 8 linhas (daí em diante rola)
 * e mostra um contador de caracteres abaixo: "n caracteres", ou "n/máximo"
 * quando `maximo` é informado (só então o tamanho é limitado, via
 * `maxLength`). Repassa todas as props de `<textarea>`. Visual do
 * `Textarea` do protótipo (Etapa 8): `className` soma às classes dele.
 */
import { useLayoutEffect, useRef, useState, type ChangeEvent, type TextareaHTMLAttributes } from 'react';
import { Textarea } from '@/components/ui/textarea';

const MAXIMO_LINHAS = 8;

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { maximo?: number };

function px(valor: string): number {
  return parseFloat(valor) || 0;
}

export function AreaTextoCrescente({ maximo, value, defaultValue, onChange, rows = 3, ...resto }: Props) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [tamanhoInterno, setTamanhoInterno] = useState(String(defaultValue ?? '').length);
  const tamanho = value !== undefined ? String(value).length : tamanhoInterno;

  // Mede a altura do conteúdo a cada mudança e ajusta, com teto de 8 linhas.
  useLayoutEffect(() => {
    const area = ref.current;
    if (!area) return;

    const estilo = getComputedStyle(area);
    const bordas = px(estilo.borderTopWidth) + px(estilo.borderBottomWidth);
    const alturaLinha = px(estilo.lineHeight) || px(estilo.fontSize) * 1.45;
    const alturaMaxima = alturaLinha * MAXIMO_LINHAS + px(estilo.paddingTop) + px(estilo.paddingBottom) + bordas;

    area.style.height = 'auto';
    const alturaConteudo = area.scrollHeight + bordas;
    const passouDoTeto = alturaMaxima > 0 && alturaConteudo > alturaMaxima;
    area.style.height = `${passouDoTeto ? alturaMaxima : alturaConteudo}px`;
    area.style.overflowY = passouDoTeto ? 'auto' : 'hidden';
  }, [value, tamanhoInterno]);

  function handleChange(event: ChangeEvent<HTMLTextAreaElement>): void {
    setTamanhoInterno(event.target.value.length);
    onChange?.(event);
  }

  return (
    <div className="space-y-1">
      <Textarea
        {...resto}
        ref={ref}
        rows={rows}
        value={value}
        defaultValue={defaultValue}
        onChange={handleChange}
        maxLength={maximo}
      />
      <p className="text-right text-xs text-muted-foreground">
        {maximo === undefined ? `${tamanho} caracteres` : `${tamanho}/${maximo}`}
      </p>
    </div>
  );
}
