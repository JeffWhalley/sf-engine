import { useRef, useState } from 'react';
import { LicensePanel } from './LicensePanel';
import { useCalcStore, effectiveTool } from '../store/useCalcStore';
import { useLibraryStore, uid, isPersistent } from '../store/useLibraryStore';

export function LibraryPanel() {
  const jobs = useLibraryStore((s) => s.jobs);
  const userTools = useLibraryStore((s) => s.userTools);
  const saveJob = useLibraryStore((s) => s.saveJob);
  const deleteJob = useLibraryStore((s) => s.deleteJob);
  const saveTool = useLibraryStore((s) => s.saveTool);
  const deleteTool = useLibraryStore((s) => s.deleteTool);
  const exportJSON = useLibraryStore((s) => s.exportJSON);
  const importJSON = useLibraryStore((s) => s.importJSON);

  const loadSnapshot = useCalcStore((s) => s.loadSnapshot);
  const adoptTool = useCalcStore((s) => s.adoptTool);

  const [name, setName] = useState('');
  const [copied, setCopied] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const persistent = isPersistent();

  function handleSaveJob() {
    saveJob(name || 'Untitled', useCalcStore.getState().snapshot());
    setName('');
  }

  function handleSaveTool() {
    const tool = effectiveTool(useCalcStore.getState());
    const id = uid('user-tool');
    const custom = { ...tool, id, name: `${tool.name} (custom)` };
    saveTool(custom);
    adoptTool(id);
  }

  function handleExport() {
    const json = exportJSON();
    navigator.clipboard?.writeText(json).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      },
      () => undefined,
    );
    // also offer a download
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'feeds-speeds-library.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleImportFile(file: File) {
    file.text().then((text) => {
      const res = importJSON(text);
      setImportError(res.ok ? null : (res.error ?? 'Import failed'));
    });
  }

  const btn =
    'rounded border border-hairline bg-machined px-2.5 py-1 font-display text-[11px] uppercase tracking-wider text-ink-2 transition-colors hover:border-accent hover:text-ink';

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="engraved text-[11px]">Library</span>
        <span className="h-px flex-1 bg-hairline" />
        {!persistent && (
          <span className="font-mono text-[10px] text-warn/80" title="localStorage unavailable here">
            in-memory
          </span>
        )}
      </div>

      {/* Save current setup as a job */}
      <div className="flex gap-2">
        <input
          className="field-input flex-1"
          placeholder="Name this setup…"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSaveJob()}
        />
        <button className={btn} onClick={handleSaveJob}>
          Save job
        </button>
      </div>

      {/* Saved jobs */}
      {jobs.length > 0 && (
        <ul className="space-y-1">
          {jobs
            .slice()
            .reverse()
            .map((j) => (
              <li key={j.id} className="flex items-center gap-2 text-[12px]">
                <span className="min-w-0 flex-1 truncate text-ink-2">{j.name}</span>
                <button className="font-display text-[11px] uppercase tracking-wider text-accent hover:text-ink" onClick={() => loadSnapshot(j.snapshot)}>
                  Load
                </button>
                <button className="font-display text-[11px] uppercase tracking-wider text-ink-3 hover:text-danger" onClick={() => deleteJob(j.id)}>
                  Del
                </button>
              </li>
            ))}
        </ul>
      )}

      {/* Saved tools */}
      {userTools.length > 0 && (
        <div className="space-y-1">
          <span className="engraved text-[10px]">Saved tools</span>
          <ul className="space-y-1">
            {userTools.map((t) => (
              <li key={t.id} className="flex items-center gap-2 text-[12px]">
                <span className="min-w-0 flex-1 truncate text-ink-3">★ {t.name}</span>
                <button className="font-display text-[11px] uppercase tracking-wider text-ink-3 hover:text-danger" onClick={() => deleteTool(t.id)}>
                  Del
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button className={btn} onClick={handleSaveTool}>
          Save tool
        </button>
        <button className={btn} onClick={handleExport}>
          {copied ? 'Copied ✓' : 'Export'}
        </button>
        <button className={btn} onClick={() => fileRef.current?.click()}>
          Import
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImportFile(file);
            e.target.value = '';
          }}
        />
      </div>
      {importError && <p className="text-[11px] text-danger">{importError}</p>}
      <LicensePanel />
    </div>
  );
}
