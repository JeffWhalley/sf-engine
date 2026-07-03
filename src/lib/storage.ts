/**
 * Tiny persistence wrapper. Uses localStorage when it's actually usable and
 * falls back to an in-memory store otherwise (e.g. inside a Claude Artifact
 * preview or a file:// context where localStorage may be blocked). PLAN §6.1.
 *
 * All keys are namespaced under "sf:". JSON only.
 */

const NS = 'sf:';

interface Backing {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function memoryBacking(): Backing {
  const m = new Map<string, string>();
  return {
    getItem: (k) => (m.has(k) ? (m.get(k) as string) : null),
    setItem: (k, v) => {
      m.set(k, v);
    },
    removeItem: (k) => {
      m.delete(k);
    },
  };
}

let persistent = false;

function pickBacking(): Backing {
  if (typeof window !== 'undefined') {
    try {
      const ls = window.localStorage;
      const probe = `${NS}__probe__`;
      ls.setItem(probe, '1');
      ls.removeItem(probe);
      persistent = true;
      return ls;
    } catch {
      // fall through to memory
    }
  }
  return memoryBacking();
}

const backing = pickBacking();

/** Whether saves survive a reload (true = real localStorage). */
export const isPersistent = (): boolean => persistent;

export const storage = {
  getJSON<T>(key: string, fallback: T): T {
    try {
      const raw = backing.getItem(NS + key);
      return raw != null ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  setJSON(key: string, value: unknown): void {
    try {
      backing.setItem(NS + key, JSON.stringify(value));
    } catch {
      // storage full or unavailable — ignore; state still lives in memory
    }
  },
  remove(key: string): void {
    try {
      backing.removeItem(NS + key);
    } catch {
      // ignore
    }
  },
};
