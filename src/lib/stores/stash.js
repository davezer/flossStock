import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';

const KEY = 'flossbox:stash';

function start() {
  if (!browser) return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '[]');
    return Array.isArray(raw) ? raw.map(String) : [];
  } catch {
    return [];
  }
}

const base = writable(start());

// persist to localStorage
if (browser) base.subscribe((v) => localStorage.setItem(KEY, JSON.stringify(v)));

const toCode = (x) => String(x);
const uniq = (arr) => Array.from(new Set((Array.isArray(arr) ? arr : []).map(toCode)));

export const stash = {
  subscribe: base.subscribe,                     // $stash -> array of codes
  add(code)    { base.update((s) => (s.includes(toCode(code)) ? s : [...s, toCode(code)])); },
  remove(code) { base.update((s) => s.filter((c) => c !== toCode(code))); },
  toggle(code) { base.update((s) => s.includes(toCode(code)) ? s.filter((c) => c !== toCode(code)) : [...s, toCode(code)]); },
  clear()      { base.set([]); },
  setAll(arr)  { base.set(uniq(arr)); }
};

// handy derived stores
export const stashSet   = derived(base, (s) => new Set(s.map(toCode))); // $stashSet.has('413')
export const stashCount = derived(base, (s) => s.length);
