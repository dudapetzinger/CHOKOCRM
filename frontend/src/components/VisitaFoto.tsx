/**
 * Exibe a foto de comprovação de uma visita. Os bytes chegam pelo hook
 * `useVisitaFoto` (chamada autenticada) e viram um `blob:` URL, liberado
 * no cleanup para não vazar memória. Na ficha aparece em miniatura (visual
 * do protótipo, Etapa 8); tocar nela abre a foto inteira numa aba nova.
 */
import { useEffect, useState } from 'react';
import { useVisitaFoto } from '../hooks/useVisitas';

type Props = { visitaId: string };

export function VisitaFoto({ visitaId }: Props) {
  const { data: blob, isLoading, isError } = useVisitaFoto(visitaId);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob]);

  if (isError) {
    return <p className="mt-2 text-xs text-muted-foreground">Não foi possível carregar a foto desta visita.</p>;
  }

  if (isLoading || !url) {
    return <p className="mt-2 text-xs text-muted-foreground">Carregando foto...</p>;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener"
      className="mt-2 inline-block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <img className="h-20 w-28 rounded-lg object-cover" src={url} alt="Foto de comprovação da visita" />
    </a>
  );
}
