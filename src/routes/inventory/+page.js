// Universal loader (client-safe). We don't rely on locals here.
// We'll let the API tell us whether the user is signed in.
export const load = async ({ fetch }) => {
  const r = await fetch('/api/inventory', { cache: 'no-store' });
  const j = await r.json().catch(() => ({}));
  return {
    user: j.user ?? null,
    items: Array.isArray(j.items) ? j.items : []
  };
};
