/**
 * Seletor da recorrência de visitas (UC09): atalhos de 15, 20 e 30 dias
 * (a faixa sugerida) e "Outro", que revela um campo numérico de 1 a 365.
 * Um valor fora dos atalhos já abre com "Outro" marcado e o campo
 * preenchido. O campo vazio é repassado como `NaN`, para a validação de
 * quem usa o seletor (ver `RecorrenciaCard`) acusar o erro.
 */
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { proximoIndicePorSeta } from '../lib/navegacaoSetas';

const ATALHOS = [15, 20, 30];
const OUTRO = 'outro';
type Opcao = number | typeof OUTRO;
const OPCOES: Opcao[] = [...ATALHOS, OUTRO];

type Props = {
  valor: number;
  onChange: (dias: number) => void;
  /** `id` do campo numérico de "Outro", para um `<label htmlFor>` externo. */
  id: string;
};

function textoDe(valor: number): string {
  return Number.isNaN(valor) ? '' : String(valor);
}

function numeroDe(texto: string): number {
  return texto.trim() === '' ? Number.NaN : Number(texto);
}

export function SeletorRecorrencia({ valor, onChange, id }: Props) {
  const [outroAtivo, setOutroAtivo] = useState(!ATALHOS.includes(valor));
  const [textoOutro, setTextoOutro] = useState(textoDe(valor));
  const botoes = useRef<(HTMLButtonElement | null)[]>([]);
  const campoOutro = useRef<HTMLInputElement | null>(null);
  // Um clique em "Outro" leva o foco ao campo; pelas setas, o foco fica no grupo.
  const focarCampoOutro = useRef(false);

  useEffect(() => {
    if (outroAtivo && focarCampoOutro.current) {
      campoOutro.current?.focus();
    }
    focarCampoOutro.current = false;
  }, [outroAtivo]);

  const indiceAtual = outroAtivo ? ATALHOS.length : ATALHOS.indexOf(valor);

  function escolher(opcao: Opcao): void {
    if (opcao === OUTRO) {
      // Parte do valor atual, para "Outro" não alterar nada até a digitação.
      const texto = textoDe(valor);
      setOutroAtivo(true);
      setTextoOutro(texto);
      onChange(numeroDe(texto));
      return;
    }
    setOutroAtivo(false);
    onChange(opcao);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    // Teclas digitadas no campo "Outro" não pertencem ao grupo de opções.
    if (event.target === campoOutro.current) return;
    const proximo = proximoIndicePorSeta(event.key, Math.max(indiceAtual, 0), OPCOES.length);
    if (proximo === null) return;
    event.preventDefault();
    escolher(OPCOES[proximo]);
    botoes.current[proximo]?.focus();
  }

  function alterarOutro(texto: string): void {
    setTextoOutro(texto);
    onChange(numeroDe(texto));
  }

  return (
    <div className="seletor-recorrencia">
      <div className="segmentado" role="radiogroup" aria-label="Recorrência de visitas" onKeyDown={handleKeyDown}>
        {OPCOES.map((opcao, indice) => {
          const marcado = indice === indiceAtual;
          // Nenhuma opção marcada (não deveria ocorrer): o primeiro atalho fica no Tab.
          const focavel = marcado || (indiceAtual < 0 && indice === 0);
          return (
            <button
              key={opcao}
              ref={(elemento) => {
                botoes.current[indice] = elemento;
              }}
              type="button"
              role="radio"
              aria-checked={marcado}
              tabIndex={focavel ? 0 : -1}
              className="segmentado-opcao"
              onClick={() => {
                focarCampoOutro.current = opcao === OUTRO;
                escolher(opcao);
              }}
            >
              {opcao === OUTRO ? 'Outro' : `${opcao} dias`}
            </button>
          );
        })}
      </div>

      {outroAtivo && (
        <input
          ref={campoOutro}
          type="number"
          id={id}
          className="seletor-recorrencia-outro"
          inputMode="numeric"
          min={1}
          max={365}
          value={textoOutro}
          onChange={(event) => alterarOutro(event.target.value)}
        />
      )}
    </div>
  );
}
