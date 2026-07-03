import { useEffect, useState } from 'react';

/**
 * Phase 10 T1 — service-worker update toast (prompt-style registration).
 * Import of the virtual module is dynamic so tests / non-PWA dev never break.
 */
export function UpdateToast() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [update, setUpdate] = useState<(() => void) | null>(null);

  useEffect(() => {
    let alive = true;
    import('virtual:pwa-register')
      .then(({ registerSW }) => {
        const updateSW = registerSW({
          onNeedRefresh() { if (alive) { setNeedRefresh(true); setUpdate(() => () => updateSW(true)); } },
          onOfflineReady() {
            if (!alive) return;
            setOfflineReady(true);
            setTimeout(() => alive && setOfflineReady(false), 4000);
          },
        });
      })
      .catch(() => { /* dev / test: virtual module absent */ });
    return () => { alive = false; };
  }, []);

  if (!needRefresh && !offlineReady) return null;
  return (
    <div className="no-print fixed bottom-4 right-4 z-50 rounded border border-hairline bg-machined-hi px-3 py-2 shadow-lg">
      {offlineReady && !needRefresh && (
        <p className="font-mono text-[11px] text-ink-2">Ready to work offline.</p>
      )}
      {needRefresh && (
        <div className="flex items-center gap-3">
          <p className="font-mono text-[11px] text-ink-2">Update available.</p>
          <button
            onClick={() => update?.()}
            className="rounded bg-accent/20 px-2 py-0.5 font-display text-[11px] uppercase tracking-wider text-accent"
          >
            Reload
          </button>
          <button
            onClick={() => setNeedRefresh(false)}
            className="font-mono text-[11px] text-ink-3"
          >
            Later
          </button>
        </div>
      )}
    </div>
  );
}
