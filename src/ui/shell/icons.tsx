import type { SVGProps } from 'react';

/**
 * Иконочный набор панели команд (spec: app-shell / «Command bar and status
 * line»). Иконки — монохромные линейные SVG, наследуют цвет текста
 * (`currentColor`), поэтому подходят и светлой, и тёмной теме.
 */

/** Имена иконок панели команд. */
export type IconName =
  | 'film'
  | 'paper'
  | 'matcher'
  | 'open'
  | 'save'
  | 'step-tablet'
  | 'print'
  | 'options'
  | 'help';

/** Геометрия иконок (линейный стиль, единая сетка 24×24). */
const PATHS: Record<IconName, string[]> = {
  film: ['M3 5h18v14H3z', 'M7 5v14M17 5v14', 'M3 10h4M3 14h4M17 10h4M17 14h4'],
  paper: ['M6 3h8l4 4v14H6z', 'M14 3v4h4', 'M9 12h6M9 16h6'],
  matcher: ['M8 7h11M16 4l3 3-3 3', 'M16 17H5M8 14l-3 3 3 3'],
  open: ['M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z'],
  save: ['M5 3h11l3 3v15H5z', 'M8 3v6h7V3', 'M8 21v-7h8v7'],
  'step-tablet': ['M3 4h18v16H3z', 'M9 4v16M15 4v16', 'M3 9h18M3 15h18'],
  print: ['M7 9V4h10v5', 'M4 9h16v7H4z', 'M7 14h10v6H7z'],
  options: [
    'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
    'M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4',
  ],
  help: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M9.4 9a2.6 2.6 0 1 1 3.6 2.4c-.8.4-1 .9-1 1.6'],
};

/** Линейная иконка панели команд. */
export function Icon({
  name,
  size = 16,
  ...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {PATHS[name].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
