/**
 * Exibe a foto de comprovação de uma visita. Os bytes chegam pelo hook
 * `useVisitaFoto` (chamada autenticada) e viram um `blob:` URL, liberado
 * no cleanup para não vazar memória.
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
    return <p className="campo-ajuda">Não foi possível carregar a foto desta visita.</p>;
  }

  if (isLoading || !url) {
    return <p className="campo-ajuda">Carregando foto...</p>;
  }

  return <img className="visita-foto" src={url} alt="Foto de comprovação da visita" />;
}
