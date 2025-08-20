import colors from '$lib/data/dmc.json';

export function load() {
  const all = [...colors].sort((a, b) => Number(a.code) - Number(b.code));
  return { colors: all };
}