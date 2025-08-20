import colors from '$lib/data/dmc.json'; // adjust path if your routes/ nesting changes

export function load() {
  // If you later fetch from an API/DB, move to +page.server.js
  return { colors };
}
