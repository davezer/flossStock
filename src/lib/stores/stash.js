import { writable, derived } from 'svelte/store';

const initial = {
  search: '',
  filters: {},
  // inventory keyed by fullCode (e.g., "01")
  inventory: {}
};

const base = writable(initial);

export const stash = {
  subscribe: base.subscribe,
  set: base.set,
  update: base.update,

  clear() {
    base.set(initial);
  },

  setSearch(q) {
    base.update((s) => ({ ...s, search: String(q || '') }));
  },

  setQty(fullCode, qty) {
    const code = String(fullCode || '');
    const next = Math.max(0, Number(qty) || 0);
    base.update((s) => ({
      ...s,
      inventory: { ...s.inventory, [code]: next }
    }));
  },

  inc(fullCode, delta = 1) {
    const code = String(fullCode || '');
    const d = Number(delta) || 0;
    base.update((s) => {
      const cur = Number(s.inventory[code] || 0);
      const next = Math.max(0, cur + d);
      return { ...s, inventory: { ...s.inventory, [code]: next } };
    });
  }
};

// Convenience function export your page expects
export function stashSet(fullCode, qty) {
  stash.setQty(fullCode, qty);
}

// Total count across all colors
export const stashCount = derived(base, ($s) =>
  Object.values($s.inventory).reduce((sum, n) => sum + (Number(n) || 0), 0)
);
