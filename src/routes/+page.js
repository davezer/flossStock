import dmc from '$lib/data/dmc.json';

export function load() {
  // If you later fetch from an API/DB, move to +page.server.js
  return { dmc };
}
