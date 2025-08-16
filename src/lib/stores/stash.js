// src/lib/stores/stash.js
import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

const KEY = 'flossstock:dmc-stash';

function createStash() {
  const initial = browser ? JSON.parse(localStorage.getItem(KEY) || '[]') : [];
  const store = writable(initial);

  if (browser) {
    store.subscribe((val) => localStorage.setItem(KEY, JSON.stringify(val)));
  }

  return {
    subscribe: store.subscribe,
    add: (code) => store.update((arr) => (arr.includes(code) ? arr : [...arr, code])),
    remove: (code) => store.update((arr) => arr.filter((c) => c !== code)),
    toggle: (code) =>
      store.update((arr) => (arr.includes(code) ? arr.filter((c) => c !== code) : [...arr, code])),
    clear: () => store.set([])
  };
}

export const stash = createStash();
export const stashSet = derived(stash, ($s) => new Set($s)); // fast lookups
export const stashCount = derived(stash, ($s) => $s.length);
