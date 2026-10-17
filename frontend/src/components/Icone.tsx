/**
 * Ícones SVG inline do ChokoCRM (traço, 24x24), no lugar dos emojis.
 *
 * Os traçados (`d` de cada <path>) vêm do Lucide (https://lucide.dev),
 * licença ISC:
 *
 *   Copyright (c) for portions of Lucide are held by Cole Bemis 2013-2022
 *   as part of Feather (MIT). All other copyright (c) for Lucide are held
 *   by Lucide Contributors 2022.
 *   Permission to use, copy, modify, and/or distribute this software for any
 *   purpose with or without fee is hereby granted, provided that the above
 *   copyright notice and this permission notice appear in all copies.
 *   THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 *   WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 *   MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 *   ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 *   WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 *   ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 *   OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * Círculos e retângulos do original foram convertidos em paths, para cada
 * ícone ser só uma lista de traçados.
 *
 * Sem `rotulo` o ícone é decorativo (aria-hidden): o texto ao lado dá o
 * nome. Com `rotulo` vira uma imagem acessível. A cor vem de `currentColor`.
 */

export type NomeDoIcone =
  | 'users'
  | 'calendar'
  | 'bar-chart'
  | 'phone'
  | 'message-circle'
  | 'log-out'
  | 'arrow-left'
  | 'plus'
  | 'search'
  | 'alert-triangle'
  | 'inbox'
  | 'calendar-check'
  | 'mouse-pointer-click'
  | 'help-circle'
  | 'check'
  | 'x'
  | 'chevron-down'
  | 'chevron-right'
  | 'camera'
  | 'pencil'
  | 'wifi-off'
  | 'download'
  | 'info'
  | 'package'
  | 'lightbulb'
  | 'user'
  | 'user-cog'
  | 'more-horizontal'
  | 'party-popper'
  | 'file-text'
  | 'history'
  | 'repeat'
  | 'key';

/** Um `d` por <path>; ícones com mais de um traço têm mais de um item. */
export const ICONES: Record<NomeDoIcone, readonly string[]> = {
  users: [
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2',
    'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
    'M22 21v-2a4 4 0 0 0-3-3.87',
    'M16 3.13a4 4 0 0 1 0 7.75',
  ],
  calendar: [
    'M8 2v4',
    'M16 2v4',
    'M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
    'M3 10h18',
  ],
  'bar-chart': ['M3 3v18h18', 'M18 17V9', 'M13 17V5', 'M8 17v-3'],
  phone: [
    'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z',
  ],
  'message-circle': ['M7.9 20A9 9 0 1 0 4 16.1L2 22Z'],
  'log-out': ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4', 'm16 17 5-5-5-5', 'M21 12H9'],
  'arrow-left': ['m12 19-7-7 7-7', 'M19 12H5'],
  plus: ['M5 12h14', 'M12 5v14'],
  search: ['M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16', 'm21 21-4.3-4.3'],
  'alert-triangle': [
    'm21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3',
    'M12 9v4',
    'M12 17h.01',
  ],
  inbox: [
    'M22 12h-6l-2 3h-4l-2-3H2',
    'M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z',
  ],
  'calendar-check': [
    'M8 2v4',
    'M16 2v4',
    'M21 14V6a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8',
    'M3 10h18',
    'm16 20 2 2 4-4',
  ],
  'mouse-pointer-click': [
    'M14 4.1 12 6',
    'm5.1 8-2.9-.8',
    'm6 12-1.9 2',
    'M7.2 2.2 8 5.1',
    'M9.037 9.69a.498.498 0 0 1 .653-.653l11 4.5a.5.5 0 0 1-.074.949l-4.349 1.041a1 1 0 0 0-.74.739l-1.04 4.35a.5.5 0 0 1-.95.074z',
  ],
  'help-circle': [
    'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20',
    'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3',
    'M12 17h.01',
  ],
  check: ['M20 6 9 17l-5-5'],
  x: ['M18 6 6 18', 'm6 6 12 12'],
  'chevron-down': ['m6 9 6 6 6-6'],
  'chevron-right': ['m9 18 6-6-6-6'],
  camera: [
    'M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z',
    'M12 10a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
  ],
  pencil: ['M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z', 'm15 5 4 4'],
  'wifi-off': [
    'M12 20h.01',
    'M8.5 16.429a5 5 0 0 1 7 0',
    'M5 12.859a10 10 0 0 1 5.17-2.69',
    'M19 12.859a10 10 0 0 0-2.007-1.523',
    'M2 8.82a15 15 0 0 1 4.177-2.643',
    'M22 8.82a15 15 0 0 0-11.288-3.764',
    'm2 2 20 20',
  ],
  download: ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4', 'm7 10 5 5 5-5', 'M12 15V3'],
  info: ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20', 'M12 16v-4', 'M12 8h.01'],
  package: [
    'm7.5 4.27 9 5.15',
    'M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z',
    'm3.3 7 8.7 5 8.7-5',
    'M12 22V12',
  ],
  lightbulb: [
    'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5',
    'M9 18h6',
    'M10 22h4',
  ],
  user: ['M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2', 'M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8'],
  'user-cog': [
    'M10 15H6a4 4 0 0 0-4 4v2',
    'M18 12a3 3 0 1 0 0 6 3 3 0 0 0 0-6',
    'M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
    'm21.7 16.4-.9-.3',
    'm15.2 13.9-.9-.3',
    'm16.6 18.7.3-.9',
    'm19.1 12.2.3-.9',
    'm19.6 18.7-.4-1',
    'm16.8 12.3-.4-1',
    'm14.3 16.6 1-.4',
    'm20.7 13.8 1-.4',
  ],
  'more-horizontal': [
    'M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2',
    'M19 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2',
    'M5 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2',
  ],
  'party-popper': [
    'M5.8 11.3 2 22l10.7-3.79',
    'M4 3h.01',
    'M22 8h.01',
    'M15 2h.01',
    'M22 20h.01',
    'm22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10',
    'm22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11c-.11.7-.72 1.22-1.43 1.22H17',
    'm11 2 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7',
    'M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z',
  ],
  'file-text': [
    'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z',
    'M14 2v4a2 2 0 0 0 2 2h4',
    'M10 9H8',
    'M16 13H8',
    'M16 17H8',
  ],
  history: ['M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8', 'M3 3v5h5', 'M12 7v5l4 2'],
  repeat: ['m17 2 4 4-4 4', 'M3 11v-1a4 4 0 0 1 4-4h14', 'm7 22-4-4 4-4', 'M21 13v1a4 4 0 0 1-4 4H3'],
  key: [
    'm15.5 7.5 2.3 2.3a1 1 0 0 0 1.4 0l2.1-2.1a1 1 0 0 0 0-1.4L19 4',
    'm21 2-9.6 9.6',
    'M7.5 10a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11',
  ],
};

type Props = {
  nome: NomeDoIcone;
  /** Lado em pixels (o ícone é quadrado). */
  tamanho?: number;
  /** Nome acessível; sem ele o ícone é decorativo. */
  rotulo?: string;
  className?: string;
};

export function Icone({ nome, tamanho = 20, rotulo, className }: Props) {
  const acessibilidade = rotulo
    ? { role: 'img' as const, 'aria-label': rotulo }
    : { 'aria-hidden': true as const };

  return (
    <svg
      viewBox="0 0 24 24"
      width={tamanho}
      height={tamanho}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`icone ${className ?? ''}`.trim()}
      {...acessibilidade}
    >
      {ICONES[nome].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
