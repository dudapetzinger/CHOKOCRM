import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Junta classes do Tailwind (padrão do shadcn): aceita condicionais do
 * `clsx` e, quando duas utilidades disputam a mesma propriedade (`p-2` e
 * `p-4`), fica a última.
 */
export function cn(...entradas: ClassValue[]): string {
  return twMerge(clsx(entradas));
}
