import { useState } from 'react';
import { useLicenseStore, isPro } from '../store/useLicenseStore';

/**
 * Phase 13b — paste-a-license activation. Lives in the library panel; all
 * failure modes fall back to the free tier with a plain-language message.
 */
export function LicensePanel() {
  const lic = useLicenseStore();
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const pro = isPro(lic);

  return (
    <div className="border-t border-hairline pt-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setOpen(!open)}
          className="engraved text-[10px] text-ink-3 transition-colors hover:text-ink"
        >
          {open ? '▾' : '▸'} License
        </button>
        <span
          className={`rounded px-1.5 py-0.5 font-display text-[10px] uppercase tracking-widest ${
            pro ? 'bg-ok/15 text-ok' : 'text-ink-3'
          }`}
        >
          {pro ? `Pro · ${lic.payload?.tier}` : 'Free tier'}
        </span>
      </div>

      {open && (
        <div className="mt-2 space-y-2">
          {pro ? (
            <>
              <p className="font-mono text-[11px] text-ink-2">
                Licensed to {lic.payload?.email}
                {lic.payload?.issuedAt && (
                  <span className="text-ink-3"> · issued {lic.payload.issuedAt.slice(0, 10)}</span>
                )}
              </p>
              <button
                onClick={() => lic.deactivate()}
                className="rounded px-2 py-0.5 font-display text-[11px] uppercase tracking-wider text-ink-3 hover:text-ink"
              >
                Remove license
              </button>
            </>
          ) : (
            <>
              <textarea
                className="field-input h-16 resize-none font-mono text-[10px]"
                placeholder="Paste your SFL1. license here"
                aria-label="License text"
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <button
                  onClick={() => void lic.activate(text)}
                  disabled={lic.status === 'checking' || text.trim() === ''}
                  className="rounded bg-accent/20 px-3 py-1 font-display text-[11px] uppercase tracking-wider text-accent disabled:opacity-40"
                >
                  {lic.status === 'checking' ? 'Checking…' : 'Activate'}
                </button>
                {lic.error && <span className="font-mono text-[10px] text-warn">{lic.error}</span>}
              </div>
              <p className="font-mono text-[10px] leading-relaxed text-ink-3">
                Licenses are verified fully offline — nothing is sent anywhere.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
