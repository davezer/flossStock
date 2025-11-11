import { writable } from 'svelte/store';

/**
 * @typedef {{ id: number, text: string, kind?: 'ok'|'err' }} Toast
 */

/** @type {import('svelte/store').Writable<Toast[]>} */
export const toasts = writable([]);

let id = 0;
export function pushToast(text, kind = 'ok', ms = 1800) {
  const t = { id: ++id, text, kind };
  toasts.update(a => [...a, t]);
  setTimeout(() => toasts.update(a => a.filter(x => x.id !== t.id)), ms);
}