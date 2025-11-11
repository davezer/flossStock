export const ssr = true;
export const prerender = false;

export async function load({ fetch }) {
  const r = await fetch('/api/colors?limit=5000', { cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  return { colors: Array.isArray(j) ? j : (j?.data ?? []) };
}
