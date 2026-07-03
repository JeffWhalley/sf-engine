import type { Advisory } from '../ui/warnings';

const STYLE = {
  info: { dot: 'text-ok', text: 'text-ink-3', glyph: '●' },
  warn: { dot: 'text-warn', text: 'text-ink-2', glyph: '▲' },
  danger: { dot: 'text-danger', text: 'text-ink', glyph: '■' },
} as const;

export function WarningList({ items }: { items: Advisory[] }) {
  return (
    <ul className="space-y-1.5">
      {items.map((a, i) => {
        const s = STYLE[a.severity];
        return (
          <li key={i} className="flex items-start gap-2 text-[12px] leading-snug">
            <span className={`mt-[1px] text-[9px] ${s.dot}`} aria-hidden>
              {s.glyph}
            </span>
            <span className={s.text}>{a.message}</span>
          </li>
        );
      })}
    </ul>
  );
}
